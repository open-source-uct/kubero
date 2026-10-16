import { Module } from "@nestjs/common";
import { KubernetesModule } from "../kubernetes/kubernetes.module";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";

@Module({
	controllers: [MetricsController],
	providers: [MetricsService, KubernetesModule],
})
export class MetricsModule {}
