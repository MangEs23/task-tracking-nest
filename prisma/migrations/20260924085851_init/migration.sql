-- CreateTable
CREATE TABLE "m_user" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "m_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "m_project" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "m_project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_project_member" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "t_project_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_epic" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_epic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "r_status" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "r_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_task" (
    "id" UUID NOT NULL,
    "epic_id" UUID NOT NULL,
    "status_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT,
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_task_assignee" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "t_task_assignee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "m_user_email_key" ON "m_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "t_project_member_project_id_user_id_key" ON "t_project_member"("project_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "t_task_assignee_task_id_user_id_key" ON "t_task_assignee"("task_id", "user_id");

-- AddForeignKey
ALTER TABLE "m_project" ADD CONSTRAINT "m_project_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "m_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_project_member" ADD CONSTRAINT "t_project_member_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "m_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_project_member" ADD CONSTRAINT "t_project_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "m_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_epic" ADD CONSTRAINT "t_epic_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "m_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "r_status" ADD CONSTRAINT "r_status_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "m_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_task" ADD CONSTRAINT "t_task_epic_id_fkey" FOREIGN KEY ("epic_id") REFERENCES "t_epic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_task" ADD CONSTRAINT "t_task_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "r_status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_task_assignee" ADD CONSTRAINT "t_task_assignee_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "t_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_task_assignee" ADD CONSTRAINT "t_task_assignee_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "m_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
