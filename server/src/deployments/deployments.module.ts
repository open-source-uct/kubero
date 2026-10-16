import { Module } from "@nestjs/common";
import { AppsService } from "../apps/apps.service";
import { LogsService } from "../logs/logs.service";
import { DeploymentsController } from "./deployments.controller";
import { DeploymentsService } from "./deployments.service";

@Module({
	controllers: [DeploymentsController],
	providers: [DeploymentsService, AppsService, LogsService],
})
export class DeploymentsModule {}
