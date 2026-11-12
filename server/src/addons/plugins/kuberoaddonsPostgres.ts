import { Plugin } from './plugin';
import { IPlugin, IPluginFormFields } from './plugin.interface';

// Classname must be same as the CRD's Name
export class KuberoAddonPostgres extends Plugin implements IPlugin {
  public id: string = 'kubero-operator'; //same as operator name
  public displayName = 'PostgreSQL';
  public description =
    'PostgreSQL (Postgres) is an open source object-relational database known for reliability and data integrity. ACID-compliant, it supports foreign keys, joins, views, triggers and stored procedures.';
  public icon = '/img/addons/pgsql.svg';
  public install: string = '';
  public url =
    'https://artifacthub.io/packages/olm/community-operators/kubero-operator';
  public docs = [
    {
      title: 'Kubero Docs',
      url: '',
    },
  ];
  public artifact_url =
    'https://artifacthub.io/api/v1/packages/olm/kubero/kubero-operator';
  public beta: boolean = false;
  public deprecated: boolean = false;

  public formfields: { [key: string]: IPluginFormFields } = {
    'KuberoAddonPostgres.metadata.name': {
      type: 'text',
      label: 'PostgreSQL Instance Name',
      name: 'metadata.name',
      required: true,
      default: 'postgres',
      description: 'The name of the PostgreSQL instance',
    },
    'KuberoAddonPostgres.spec.postgres.image.tag': {
      type: 'combobox',
      label: 'Version/Tag',
      options: ['13', '14', '15', '16', '17', 'latest'], // TODO - load this dynamically
      name: 'spec.postgres.image.tag',
      required: true,
      default: '17.6',
      description: 'Version of the PostgreSQL image to use',
    },
    'KuberoAddonPostgres.spec.postgres.replicaCount': {
      type: 'number',
      label: 'Replica Count',
      name: 'spec.postgres.replicaCount',
      required: true,
      default: 1,
      description: 'Number of PostgreSQL replicas',
    },
    'KuberoAddonPostgres.spec.postgres.auth.enablePostgresUser': {
      type: 'switch',
      label: 'Enable Postgres User',
      name: 'spec.postgres.auth.enablePostgresUser',
      required: false,
      default: true,
      description: 'Enable the default postgres user',
    },
    'KuberoAddonPostgres.spec.postgres.auth.postgresPassword': {
      type: 'text',
      label: 'Postgres Password',
      name: 'spec.postgres.auth.postgresPassword',
      required: false,
      default: '',
      description: 'Password for the default postgres user',
    },
    'KuberoAddonPostgres.spec.postgres.auth.username': {
      type: 'text',
      label: 'Additional Username',
      name: 'spec.postgres.auth.username',
      required: false,
      default: '',
      description: 'Username for an additional user to create',
    },
    'KuberoAddonPostgres.spec.postgres.auth.password': {
      type: 'text',
      label: 'Additional User Password',
      name: 'spec.postgres.auth.password',
      required: false,
      default: '',
      description: 'Password for an additional user to create',
    },
    'KuberoAddonPostgres.spec.postgres.auth.database': {
      type: 'text',
      label: 'Database Name',
      name: 'spec.postgres.auth.database',
      required: false,
      default: '',
      description: 'Name for a custom database to create',
    },
    // Reserva y límite del contenedor de la base. Los valores por defecto son
    // los del chart del operador (v0.2.2-uct.3): en la UCT cada base usaba
    // 40-60m de CPU y 25-40Mi de memoria en reposo. Sin ellos la base quedaba
    // como BestEffort, la primera en ser desalojada si un nodo se queda sin
    // memoria (#224). Solo se eligen al crearla: un addon creado no se edita.
    'KuberoAddonPostgres.spec.postgres.resources.requests.cpu': {
      type: 'combobox',
      label: 'CPU Request',
      options: ['50m', '100m', '250m', '500m'],
      name: 'spec.postgres.resources.requests.cpu',
      required: true,
      default: '50m',
      description: 'CPU the node sets aside for the database',
    },
    'KuberoAddonPostgres.spec.postgres.resources.limits.cpu': {
      type: 'combobox',
      label: 'CPU Limit',
      options: ['250m', '500m', '1', '2'],
      name: 'spec.postgres.resources.limits.cpu',
      required: true,
      default: '500m',
      description: 'Maximum CPU the database can use',
    },
    'KuberoAddonPostgres.spec.postgres.resources.requests.memory': {
      type: 'combobox',
      label: 'Memory Request',
      options: ['128Mi', '256Mi', '512Mi', '1Gi'],
      name: 'spec.postgres.resources.requests.memory',
      required: true,
      default: '128Mi',
      description: 'Memory the node sets aside for the database',
    },
    'KuberoAddonPostgres.spec.postgres.resources.limits.memory': {
      type: 'combobox',
      label: 'Memory Limit',
      options: ['256Mi', '512Mi', '1Gi', '2Gi'],
      name: 'spec.postgres.resources.limits.memory',
      required: true,
      default: '512Mi',
      description:
        'Maximum memory the database can use; above it Kubernetes restarts it',
    },
    'KuberoAddonPostgres.spec.postgres.persistence.storageClass': {
      type: 'select-storageclass',
      label: 'Storage Class',
      name: 'spec.postgres.persistence.storageClass',
      required: false,
      default: '',
      description: 'Kubernetes StorageClass to use',
    },
    'KuberoAddonPostgres.spec.postgres.persistence.size': {
      type: 'text',
      label: 'Storage Size',
      name: 'spec.postgres.persistence.size',
      required: false,
      default: '8Gi',
      description: 'Size of the storage',
    },
    'KuberoAddonPostgres.spec.postgres.persistence.accessModes[0]': {
      type: 'text',
      label: 'Access Modes',
      name: 'spec.postgres.persistence.accessModes[0]',
      required: false,
      default: 'ReadWriteOnce',
      description: 'Access modes for the persistent volume',
    },
  };

  public env: any[] = [];

  public resourceDefinitions: object = {
    KuberoAddonPostgres: {
      apiVersion: 'application.kubero.dev/v1alpha1',
      kind: 'KuberoAddonPostgres',
      metadata: {
        name: 'postgres',
      },
      spec: {
        postgres: {
          image: {
            tag: '17.6',
          },
          replicaCount: 1,
          auth: {
            enablePostgresUser: true,
            postgresPassword: '',
            username: '',
            password: '',
            database: '',
          },
          resources: {
            requests: { cpu: '50m', memory: '128Mi' },
            limits: { cpu: '500m', memory: '512Mi' },
          },
          persistence: {
            enabled: true,
            storageClass: '',
            size: '8Gi',
            accessModes: ['ReadWriteOnce'],
          },
        },
      },
    },
  };

  protected additionalResourceDefinitions: object = {};

  constructor(availableOperators: any) {
    super();
    void super.init(availableOperators);
  }
}
