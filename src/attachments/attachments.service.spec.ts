import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from './attachments.service';

const PROJECT = 'project-1';
const OWNER = 'user-owner';
const OTHER = 'user-other';
const ID = 'attachment-1';
const URL_VALUE = 'https://example.com/docs';

function makeAttachment() {
  return {
    id: ID,
    project_id: PROJECT,
    type: 'link',
    title: 'Dokumentasi',
    url: URL_VALUE,
    created_by: OWNER,
    created_at: new Date('2026-10-26T00:00:00Z'),
    updated_at: new Date('2026-10-26T00:00:00Z'),
    creator: {
      id: OWNER,
      name: 'Pembuat',
    },
  };
}

function dbError(code: string) {
  return new Prisma.PrismaClientKnownRequestError(
    'Simulated database error',
    {
      code,
      clientVersion: '6.19.3',
    },
  );
}

describe('AttachmentsService', () => {
  const tx = {
    m_project: {
      findUnique: jest.fn(),
    },
    t_project_member: {
      findUnique: jest.fn(),
    },
    t_project_attachment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn(),
  };

  const service = new AttachmentsService(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.resetAllMocks();

    prisma.$transaction.mockImplementation(
      (operation: (client: typeof tx) => Promise<unknown>) =>
        operation(tx),
    );

    tx.m_project.findUnique.mockResolvedValue({
      id: PROJECT,
    });

    tx.t_project_member.findUnique.mockResolvedValue({
      user_id: OWNER,
      role: 'member',
    });

    // Lookup berdasarkan ID menemukan attachment.
    // Lookup unique URL secara default tidak menemukan duplikat.
    tx.t_project_attachment.findUnique.mockImplementation(
      async (args: { where: { id?: string } }) =>
        args.where.id ? makeAttachment() : null,
    );

    tx.t_project_attachment.count.mockResolvedValue(0);
    tx.t_project_attachment.findMany.mockResolvedValue([]);
    tx.t_project_attachment.create.mockResolvedValue(
      makeAttachment(),
    );
    tx.t_project_attachment.update.mockResolvedValue(
      makeAttachment(),
    );
    tx.t_project_attachment.delete.mockResolvedValue(
      makeAttachment(),
    );
  });

  describe('create', () => {
    it('member boleh membuat link dengan identitas dari backend', async () => {
      const result = await service.create(PROJECT, OWNER, {
        url: `  ${URL_VALUE}  `,
        title: ' Dokumentasi ',
      });

      expect(tx.t_project_attachment.create).toHaveBeenCalledWith({
        data: {
          project_id: PROJECT,
          type: 'link',
          title: 'Dokumentasi',
          url: URL_VALUE,
          created_by: OWNER,
        },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      expect(result.created_by).toEqual({
        id: OWNER,
        name: 'Pembuat',
      });
      expect(result).not.toHaveProperty('creator');

      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    });

    it.each([undefined, '', '   '])(
      'judul kosong memakai hostname: %j',
      async (title) => {
        await service.create(PROJECT, OWNER, {
          url: URL_VALUE,
          title,
        });

        expect(tx.t_project_attachment.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              title: 'example.com',
            }),
          }),
        );
      },
    );

    it('hostname terlalu panjang meminta judul manual', async () => {
      const hostname = [
        'a'.repeat(60),
        'b'.repeat(60),
        'c'.repeat(40),
        'com',
      ].join('.');

      await expect(
        service.create(PROJECT, OWNER, {
          url: `https://${hostname}/`,
        }),
      ).rejects.toMatchObject({ status: 400 });

      expect(tx.t_project_attachment.create).not.toHaveBeenCalled();
    });

    it('project tidak ditemukan → 404', async () => {
      tx.t_project_member.findUnique.mockResolvedValue(null);
      tx.m_project.findUnique.mockResolvedValue(null);

      await expect(
        service.create(PROJECT, OWNER, { url: URL_VALUE }),
      ).rejects.toMatchObject({ status: 404 });

      expect(tx.t_project_attachment.create).not.toHaveBeenCalled();
    });

    it('bukan member → 403 tanpa insert', async () => {
      tx.t_project_member.findUnique.mockResolvedValue(null);

      await expect(
        service.create(PROJECT, OTHER, { url: URL_VALUE }),
      ).rejects.toMatchObject({
        status: 403,
        message: 'Not a member of this project',
      });

      expect(tx.t_project_attachment.create).not.toHaveBeenCalled();
    });

    it('URL duplikat dalam project → 409', async () => {
      tx.t_project_attachment.findUnique.mockResolvedValue({
        id: 'duplicate',
      });

      await expect(
        service.create(PROJECT, OWNER, { url: URL_VALUE }),
      ).rejects.toMatchObject({
        status: 409,
        message: 'This link is already attached to the project',
      });

      expect(tx.t_project_attachment.findUnique).toHaveBeenCalledWith({
        where: {
          project_id_url: {
            project_id: PROJECT,
            url: URL_VALUE,
          },
        },
        select: { id: true },
      });
      expect(tx.t_project_attachment.create).not.toHaveBeenCalled();
    });

    it('jumlah 49 masih boleh menambah attachment', async () => {
      tx.t_project_attachment.count.mockResolvedValue(49);

      await service.create(PROJECT, OWNER, { url: URL_VALUE });

      expect(tx.t_project_attachment.count).toHaveBeenCalledWith({
        where: { project_id: PROJECT },
      });
      expect(tx.t_project_attachment.create).toHaveBeenCalledTimes(1);
    });

    it.each([50, 51])(
      'jumlah %i menolak penambahan → 409',
      async (count) => {
        tx.t_project_attachment.count.mockResolvedValue(count);

        await expect(
          service.create(PROJECT, OWNER, { url: URL_VALUE }),
        ).rejects.toMatchObject({
          status: 409,
          message: 'Attachment limit reached (50 per project)',
        });

        expect(tx.t_project_attachment.create).not.toHaveBeenCalled();
      },
    );

    it('duplikat saat insert (P2002) → 409', async () => {
      tx.t_project_attachment.create.mockRejectedValue(
        dbError('P2002'),
      );

      await expect(
        service.create(PROJECT, OWNER, { url: URL_VALUE }),
      ).rejects.toMatchObject({
        status: 409,
        message: 'This link is already attached to the project',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('memfilter project, mengurutkan terbaru, dan memberi can_edit', async () => {
      tx.t_project_attachment.findMany.mockResolvedValue([
        makeAttachment(),
        {
          ...makeAttachment(),
          id: 'attachment-2',
          created_by: OTHER,
          creator: { id: OTHER, name: 'Anggota lain' },
        },
      ]);

      const result = await service.findAll(PROJECT, OWNER);

      expect(result.map((item) => item.can_edit)).toEqual([
        true,
        false,
      ]);

      expect(tx.t_project_attachment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { project_id: PROJECT },
          orderBy: [
            { created_at: 'desc' },
            { id: 'desc' },
          ],
        }),
      );
    });

    it('admin mendapat can_edit untuk lampiran orang lain', async () => {
      tx.t_project_member.findUnique.mockResolvedValue({
        user_id: OTHER,
        role: 'admin',
      });
      tx.t_project_attachment.findMany.mockResolvedValue([
        makeAttachment(),
      ]);

      const result = await service.findAll(PROJECT, OTHER);

      expect(result[0].can_edit).toBe(true);
    });

    it('project tanpa lampiran menghasilkan array kosong', async () => {
      await expect(
        service.findAll(PROJECT, OWNER),
      ).resolves.toEqual([]);
    });

    it('non-member tidak boleh membaca daftar', async () => {
      tx.t_project_member.findUnique.mockResolvedValue(null);

      await expect(
        service.findAll(PROJECT, OTHER),
      ).rejects.toMatchObject({ status: 403 });

      expect(tx.t_project_attachment.findMany).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('body kosong → 400 tanpa transaksi', async () => {
      await expect(
        service.update(ID, OWNER, {}),
      ).rejects.toMatchObject({ status: 400 });

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('pembuat boleh mengubah judul saja', async () => {
      await service.update(ID, OWNER, {
        title: ' Judul baru ',
      });

      expect(tx.t_project_attachment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ID },
          data: { title: 'Judul baru' },
        }),
      );
    });

    it('mengubah URL saja tidak menimpa judul', async () => {
      await service.update(ID, OWNER, {
        url: 'https://example.org/new',
      });

      expect(tx.t_project_attachment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { url: 'https://example.org/new' },
        }),
      );
    });

    it('judul kosong memakai hostname URL baru', async () => {
      await service.update(ID, OWNER, {
        title: '',
        url: 'https://example.org/new',
      });

      expect(tx.t_project_attachment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            title: 'example.org',
            url: 'https://example.org/new',
          },
        }),
      );
    });

    it('judul kosong tanpa URL memakai hostname URL tersimpan', async () => {
      await service.update(ID, OWNER, { title: '' });

      expect(tx.t_project_attachment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { title: 'example.com' },
        }),
      );
    });

    it('URL tidak berubah tidak dianggap duplikat dirinya sendiri', async () => {
      await service.update(ID, OWNER, { url: URL_VALUE });

      expect(tx.t_project_attachment.findUnique).toHaveBeenCalledTimes(1);
      expect(tx.t_project_attachment.update).toHaveBeenCalledTimes(1);
    });

    it('URL pengganti milik attachment lain → 409', async () => {
      tx.t_project_attachment.findUnique
        .mockResolvedValueOnce(makeAttachment())
        .mockResolvedValueOnce({ id: 'attachment-2' });

      await expect(
        service.update(ID, OWNER, {
          url: 'https://example.org/duplicate',
        }),
      ).rejects.toMatchObject({ status: 409 });

      expect(tx.t_project_attachment.update).not.toHaveBeenCalled();
    });

    it('duplikat saat update (P2002) → 409', async () => {
      tx.t_project_attachment.update.mockRejectedValue(
        dbError('P2002'),
      );

      await expect(
        service.update(ID, OWNER, {
          url: 'https://example.org/new',
        }),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe.each(['update', 'remove'] as const)(
    'izin %s',
    (action) => {
      const run = (userId: string) =>
        action === 'update'
          ? service.update(ID, userId, { title: 'Baru' })
          : service.remove(ID, userId);

      it('attachment tidak ditemukan → 404', async () => {
        tx.t_project_attachment.findUnique.mockResolvedValue(null);

        await expect(run(OWNER)).rejects.toMatchObject({
          status: 404,
        });
      });

      it('member biasa bukan pembuat → 403', async () => {
        tx.t_project_member.findUnique.mockResolvedValue({
          user_id: OTHER,
          role: 'member',
        });

        await expect(run(OTHER)).rejects.toMatchObject({
          status: 403,
          message: 'You are not allowed to modify this attachment',
        });

        expect(tx.t_project_attachment.update).not.toHaveBeenCalled();
        expect(tx.t_project_attachment.delete).not.toHaveBeenCalled();
      });

      it('pembuat yang sudah bukan member → 403', async () => {
        tx.t_project_member.findUnique.mockResolvedValue(null);

        await expect(run(OWNER)).rejects.toMatchObject({
          status: 403,
          message: 'Not a member of this project',
        });

        expect(tx.t_project_attachment.update).not.toHaveBeenCalled();
        expect(tx.t_project_attachment.delete).not.toHaveBeenCalled();
      });

      it('admin project boleh mengubah lampiran orang lain', async () => {
        tx.t_project_member.findUnique.mockResolvedValue({
          user_id: OTHER,
          role: 'admin',
        });

        await run(OTHER);

        const mutation =
          action === 'update'
            ? tx.t_project_attachment.update
            : tx.t_project_attachment.delete;

        expect(mutation).toHaveBeenCalledTimes(1);
      });
    },
  );

  describe('remove', () => {
    it('pembuat boleh menghapus lampirannya sendiri', async () => {
      await expect(
        service.remove(ID, OWNER),
      ).resolves.toBeUndefined();

      expect(tx.t_project_attachment.delete).toHaveBeenCalledWith({
        where: { id: ID },
      });
    });

    it('record hilang saat delete (P2025) → 404', async () => {
      tx.t_project_attachment.delete.mockRejectedValue(
        dbError('P2025'),
      );

      await expect(
        service.remove(ID, OWNER),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('transaction conflicts', () => {
    it('retry menghitung ulang batas: 49 berubah menjadi 50', async () => {
      tx.t_project_attachment.count
        .mockResolvedValueOnce(49)
        .mockResolvedValueOnce(50);

      tx.t_project_attachment.create.mockRejectedValueOnce(
        dbError('P2034'),
      );

      await expect(
        service.create(PROJECT, OWNER, { url: URL_VALUE }),
      ).rejects.toMatchObject({
        status: 409,
        message: 'Attachment limit reached (50 per project)',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(tx.t_project_attachment.count).toHaveBeenCalledTimes(2);
      expect(tx.t_project_attachment.create).toHaveBeenCalledTimes(1);
    });

    it('retry memeriksa ulang membership sebelum insert', async () => {
      tx.t_project_member.findUnique
        .mockResolvedValueOnce({
          user_id: OWNER,
          role: 'member',
        })
        .mockResolvedValueOnce(null);

      tx.t_project_attachment.create.mockRejectedValueOnce(
        dbError('P2034'),
      );

      await expect(
        service.create(PROJECT, OWNER, { url: URL_VALUE }),
      ).rejects.toMatchObject({ status: 403 });

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(tx.t_project_attachment.create).toHaveBeenCalledTimes(1);
    });

    it('retry memeriksa ulang role sebelum menghapus', async () => {
      tx.t_project_member.findUnique
        .mockResolvedValueOnce({
          user_id: OTHER,
          role: 'admin',
        })
        .mockResolvedValueOnce({
          user_id: OTHER,
          role: 'member',
        });

      tx.t_project_attachment.delete.mockRejectedValueOnce(
        dbError('P2034'),
      );

      await expect(
        service.remove(ID, OTHER),
      ).rejects.toMatchObject({ status: 403 });

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(tx.t_project_attachment.delete).toHaveBeenCalledTimes(1);
    });

    it('konflik sekali lalu berhasil pada percobaan kedua', async () => {
      tx.t_project_attachment.create.mockRejectedValueOnce(
        dbError('P2034'),
      );

      await expect(
        service.create(PROJECT, OWNER, { url: URL_VALUE }),
      ).resolves.toMatchObject({ id: ID });

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(tx.t_project_member.findUnique).toHaveBeenCalledTimes(2);
    });

    it('konflik terus-menerus → 409 setelah tiga percobaan', async () => {
      tx.t_project_attachment.create.mockRejectedValue(
        dbError('P2034'),
      );

      await expect(
        service.create(PROJECT, OWNER, { url: URL_VALUE }),
      ).rejects.toMatchObject({
        status: 409,
        message: 'Attachment data changed concurrently, please retry',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    });

    it('error lain diteruskan tanpa retry', async () => {
      const failure = new Error('Database unavailable');
      tx.t_project_attachment.create.mockRejectedValue(failure);

      await expect(
        service.create(PROJECT, OWNER, { url: URL_VALUE }),
      ).rejects.toBe(failure);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});