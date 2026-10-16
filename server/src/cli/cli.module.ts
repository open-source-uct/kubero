import { Module } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { ResetAdminCommand } from "./commands/reset-admin.command";

@Module({
	providers: [ResetAdminCommand, DatabaseService],
})
export class CliModule {}
