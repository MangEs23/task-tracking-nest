-- CreateTable
CREATE TABLE "t_task_mention" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "mentioned_by" UUID NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_task_mention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "t_task_mention_user_id_read_at_idx" ON "t_task_mention"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "t_task_mention_task_id_user_id_key" ON "t_task_mention"("task_id", "user_id");

-- AddForeignKey
ALTER TABLE "t_task_mention" ADD CONSTRAINT "t_task_mention_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "t_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_task_mention" ADD CONSTRAINT "t_task_mention_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "m_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_task_mention" ADD CONSTRAINT "t_task_mention_mentioned_by_fkey" FOREIGN KEY ("mentioned_by") REFERENCES "m_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
