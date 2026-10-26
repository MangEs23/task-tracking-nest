-- CreateTable
CREATE TABLE "t_project_attachment" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'link',
    "title" VARCHAR(150) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_project_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "t_project_attachment_project_id_idx" ON "t_project_attachment"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "t_project_attachment_project_id_url_key" ON "t_project_attachment"("project_id", "url");

-- AddForeignKey
ALTER TABLE "t_project_attachment" ADD CONSTRAINT "t_project_attachment_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "m_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_project_attachment" ADD CONSTRAINT "t_project_attachment_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "m_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
