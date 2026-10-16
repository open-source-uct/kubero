import { Module } from "@nestjs/common";
import { AppsService } from "src/apps/apps.service";
import { LogsController } from "./logs.controller";
import { LogsService } from "./logs.service";

@Module({
	providers: [LogsService, AppsService],
	controllers: [LogsController],
})
export class LogsModule {}
