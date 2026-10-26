import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_MESSAGES } from '../common/constants/auth-messages';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { UpdateAttachmentDto } from './dto/update-attachment.dto';

const ATTACHMENT_LIMIT = 50;

const ATTACHMENT_INCLUDE = {
  creator: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.t_project_attachmentInclude;

type AttachmentWithCreator =
  Prisma.t_project_attachmentGetPayload<{
    include: typeof ATTACHMENT_INCLUDE;
  }>;

@Injectable()
export class AttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async runTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError
        ) {
          if (error.code === 'P2034') {
            if (attempt < 2) {
              continue;
            }

            throw new ConflictException(
              'Attachment data changed concurrently, please retry',
            );
          }

          if (error.code === 'P2002') {
            throw new ConflictException(
              'This link is already attached to the project',
            );
          }

          if (error.code === 'P2025') {
            throw new NotFoundException('Attachment not found');
          }
        }

        throw error;
      }
    }

    throw new ConflictException(
      'Attachment data changed concurrently, please retry',
    );
  }

  private async requireMember(
    tx: Prisma.TransactionClient,
    projectId: string,
    userId: string,
  ) {
    const membership = await tx.t_project_member.findUnique({
      where: {
        project_id_user_id: {
          project_id: projectId,
          user_id: userId,
        },
      },
      select: {
        user_id: true,
        role: true,
      },
    });

    if (membership) {
      return membership;
    }

    const project = await tx.m_project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    throw new ForbiddenException(AUTH_MESSAGES.NOT_MEMBER);
  }

  private canModify(
    createdBy: string,
    userId: string,
    projectRole: string,
  ): boolean {
    return createdBy === userId || projectRole === 'admin';
  }

  private async requireEditableAttachment(
    tx: Prisma.TransactionClient,
    attachmentId: string,
    userId: string,
  ) {
    const attachment =
      await tx.t_project_attachment.findUnique({
        where: { id: attachmentId },
        include: ATTACHMENT_INCLUDE,
      });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    const membership = await this.requireMember(
      tx,
      attachment.project_id,
      userId,
    );

    if (
      !this.canModify(
        attachment.created_by,
        userId,
        membership.role,
      )
    ) {
      throw new ForbiddenException(
        'You are not allowed to modify this attachment',
      );
    }

    return attachment;
  }

  private resolveTitle(
    title: string | undefined,
    url: string,
  ): string {
    const trimmedTitle = title?.trim();

    if (trimmedTitle) {
      return trimmedTitle;
    }

    const hostname = new URL(url).hostname;

    if (hostname.length > 150) {
      throw new BadRequestException(
        'URL hostname exceeds 150 characters; provide a shorter title',
      );
    }

    return hostname;
  }

  private format(attachment: AttachmentWithCreator) {
    return {
      id: attachment.id,
      project_id: attachment.project_id,
      type: attachment.type,
      title: attachment.title,
      url: attachment.url,
      created_by: {
        id: attachment.creator.id,
        name: attachment.creator.name,
      },
      created_at: attachment.created_at,
      updated_at: attachment.updated_at,
    };
  }

  async create(
    projectId: string,
    userId: string,
    dto: CreateAttachmentDto,
  ) {
    return this.runTransaction(async (tx) => {
      await this.requireMember(tx, projectId, userId);

      const url = dto.url.trim();

      const duplicate =
        await tx.t_project_attachment.findUnique({
          where: {
            project_id_url: {
              project_id: projectId,
              url,
            },
          },
          select: { id: true },
        });

      if (duplicate) {
        throw new ConflictException(
          'This link is already attached to the project',
        );
      }

      const count = await tx.t_project_attachment.count({
        where: { project_id: projectId },
      });

      if (count >= ATTACHMENT_LIMIT) {
        throw new ConflictException(
          'Attachment limit reached (50 per project)',
        );
      }

      const attachment =
        await tx.t_project_attachment.create({
          data: {
            project_id: projectId,
            type: 'link',
            title: this.resolveTitle(dto.title, url),
            url,
            created_by: userId,
          },
          include: ATTACHMENT_INCLUDE,
        });

      return this.format(attachment);
    });
  }

  async findAll(projectId: string, userId: string) {
    return this.runTransaction(async (tx) => {
      const membership = await this.requireMember(
        tx,
        projectId,
        userId,
      );

      const attachments =
        await tx.t_project_attachment.findMany({
          where: { project_id: projectId },
          include: ATTACHMENT_INCLUDE,
          orderBy: [
            { created_at: 'desc' },
            { id: 'desc' },
          ],
        });

      return attachments.map((attachment) => ({
        ...this.format(attachment),
        can_edit: this.canModify(
          attachment.created_by,
          userId,
          membership.role,
        ),
      }));
    });
  }

  async update(
    attachmentId: string,
    userId: string,
    dto: UpdateAttachmentDto,
  ) {
    if (
      dto.title === undefined &&
      dto.url === undefined
    ) {
      throw new BadRequestException(
        'Provide title or url to update',
      );
    }

    return this.runTransaction(async (tx) => {
      const attachment =
        await this.requireEditableAttachment(
          tx,
          attachmentId,
          userId,
        );

      const nextUrl =
        dto.url !== undefined
          ? dto.url.trim()
          : attachment.url;

      if (nextUrl !== attachment.url) {
        const duplicate =
          await tx.t_project_attachment.findUnique({
            where: {
              project_id_url: {
                project_id: attachment.project_id,
                url: nextUrl,
              },
            },
            select: { id: true },
          });

        if (duplicate) {
          throw new ConflictException(
            'This link is already attached to the project',
          );
        }
      }

      const data: Prisma.t_project_attachmentUpdateInput = {};

      if (dto.url !== undefined) {
        data.url = nextUrl;
      }

      if (dto.title !== undefined) {
        data.title = this.resolveTitle(
          dto.title,
          nextUrl,
        );
      }

      const updated =
        await tx.t_project_attachment.update({
          where: { id: attachmentId },
          data,
          include: ATTACHMENT_INCLUDE,
        });

      return this.format(updated);
    });
  }

  async remove(
    attachmentId: string,
    userId: string,
  ): Promise<void> {
    await this.runTransaction(async (tx) => {
      await this.requireEditableAttachment(
        tx,
        attachmentId,
        userId,
      );

      await tx.t_project_attachment.delete({
        where: { id: attachmentId },
      });
    });
  }
}