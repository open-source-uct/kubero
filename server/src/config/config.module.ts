import { Global, Module } from "@nestjs/common";
import { KubernetesModule } from "../kubernetes/kubernetes.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ConfigController } from "./config.controller";
import { ConfigService } from "./config.service";

@Global()
@Module({
	imports: [KubernetesModule, NotificationsModule],
	controllers: [ConfigController],
	providers: [ConfigService],
	exports: [ConfigService],
})
export class ConfigModule {}
