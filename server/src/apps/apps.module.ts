import { Module } from "@nestjs/common";
import { KubernetesModule } from "../kubernetes/kubernetes.module";
import { PipelinesService } from "../pipelines/pipelines.service";
import { AppsController } from "./apps.controller";
import { AppsService } from "./apps.service";

@Module({
	providers: [AppsService, KubernetesModule, PipelinesService],
	exports: [AppsService],
	controllers: [AppsController],
})
export class AppsModule {}
