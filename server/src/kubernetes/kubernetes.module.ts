import { Global, Module } from "@nestjs/common";
import { KubernetesController } from "./kubernetes.controller";
import { KubernetesService } from "./kubernetes.service";

@Global()
@Module({
	providers: [KubernetesService],
	exports: [KubernetesService],
	controllers: [KubernetesController],
})
export class KubernetesModule {}
