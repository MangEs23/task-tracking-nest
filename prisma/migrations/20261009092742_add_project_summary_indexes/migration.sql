-- CreateIndex
CREATE INDEX "t_epic_project_id_idx" ON "t_epic"("project_id");

-- CreateIndex
CREATE INDEX "t_task_epic_id_idx" ON "t_task"("epic_id");

-- CreateIndex
CREATE INDEX "t_task_status_id_idx" ON "t_task"("status_id");
