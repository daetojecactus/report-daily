CREATE INDEX "deliveries_user_id_index" ON "deliveries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "deliveries_report_id_index" ON "deliveries" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "reports_template_id_index" ON "reports" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "report_templates_owner_id_index" ON "report_templates" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "users_template_id_index" ON "users" USING btree ("template_id");