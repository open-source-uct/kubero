import { Module } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { AddonsModule } from "./addons/addons.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AppsModule } from "./apps/apps.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { CliModule } from "./cli/cli.module";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { DeploymentsModule } from "./deployments/deployments.module";
import { EventsModule } from "./events/events.module";
import { GroupModule } from "./groups/groups.module";
import { KubernetesModule } from "./kubernetes/kubernetes.module";
import { LogsModule } from "./logs/logs.module";
import { MetricsModule } from "./metrics/metrics.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PipelinesModule } from "./pipelines/pipelines.module";
import { RepoModule } from "./repo/repo.module";
import { RolesModule } from "./roles/roles.module";
import { StatusModule } from "./status/status.module";
import { TemplatesController } from "./templates/templates.controller";
import { TemplatesService } from "./templates/templates.service";
import { TokenModule } from "./token/token.module";

@Module({
	imports: [
		ServeStaticModule.forRoot({
			rootPath: join(__dirname, "public"),
		}),
		EventsModule,
		AuthModule,
		AppsModule,
		PipelinesModule,
		RepoModule,
		ConfigModule,
		MetricsModule,
		LogsModule,
		DeploymentsModule,
		KubernetesModule,
		AuditModule,
		AddonsModule,
		NotificationsModule,
		StatusModule,
		DatabaseModule,
		GroupModule,
		RolesModule,
		TokenModule,
		CliModule,
	],
	controllers: [AppController, TemplatesController],
	providers: [AppService, TemplatesService],
})
export class AppModule {}
