export const nixpacksTemplate = `
apiVersion: batch/v1
kind: Job
metadata:
  generation: 1
  labels:
    batch.kubernetes.io/job-name: example-test-20240631-2237
    buildstrategy: nixpacks
    kuberoapp: example
    kuberopipeline: test
    job-name: example-test-20240631-2237
  name: example-test-20240631-2237
spec:
  ttlSecondsAfterFinished: 31536000
  backoffLimit: 0
  completionMode: NonIndexed
  completions: 1
  manualSelector: false
  parallelism: 1
  podReplacementPolicy: TerminatingOrFailed
  suspend: false
  template:
    metadata:
      creationTimestamp: null
      labels:
        batch.kubernetes.io/job-name: example-test-20240631-2237
        buildstrategy: nixpacks
        kuberoapp: example
        kuberopipeline: test
        job-name: example-test-20240631-2237
    spec:
      automountServiceAccountToken: false
      securityContext:
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
        - env:
            - name: REPOSITORY
              value: registry-kubero.yourdomain.com/optionalrepositoryowner/pipeline/app
            - name: TAG
              value: "123456"
            - name: APP
              value: example
            - name: HOME
              value: /tmp
          command:
            - sh
            - -c
            - |-
              set -eu
              case "$APP" in ''|-*|*[!a-z0-9-]*) exit 1 ;; esac
              case "$REPOSITORY" in ''|*[!a-zA-Z0-9._:/-]*) exit 1 ;; esac
              case "$TAG" in ''|*[!a-zA-Z0-9_.-]*) exit 1 ;; esac
              patch=$(printf '{"spec":{"image":{"repository":"%s","tag":"%s"}}}' "$REPOSITORY" "$TAG")
              kubectl patch kuberoapps "$APP" --type=merge -p "$patch"
          image: bitnami/kubectl:latest
          imagePullPolicy: Always
          name: deploy
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
              ephemeral-storage: 256Mi
            limits:
              cpu: "2"
              memory: 2Gi
              ephemeral-storage: 4Gi
          terminationMessagePath: /dev/termination-log
          terminationMessagePolicy: File
          volumeMounts:
            - name: deploy-api-access
              mountPath: /var/run/secrets/kubernetes.io/serviceaccount
              readOnly: true
            - name: deploy-tmp
              mountPath: /tmp
          securityContext:
            privileged: false
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            runAsNonRoot: true
            runAsUser: 1001
            capabilities:
              drop:
                - ALL
      initContainers:
        - name: fetch
          env:
            - name: GIT_REPOSITORY
              value: git@github.com:kubero-dev/template-nodeapp.git
            - name: GIT_REF
              value: main
            - name: KUBERO_BUILDPACK_DEFAULT_RUN_CMD
              value: exit 0
            - name: KUBERO_BUILDPACK_DEFAULT_BUILD_CMD
              value: exit 0
          image: ghcr.io/kubero-dev/fetch:latest
          imagePullPolicy: Always
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
              ephemeral-storage: 256Mi
            limits:
              cpu: "2"
              memory: 2Gi
              ephemeral-storage: 4Gi
          securityContext:
            readOnlyRootFilesystem: false
            privileged: false
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
            runAsNonRoot: true
            runAsUser: 1000
            runAsGroup: 1000
          terminationMessagePath: /dev/termination-log
          terminationMessagePolicy: File
          volumeMounts:
            - mountPath: /home/kubero/.ssh-mounted
              name: deployment-keys
              readOnly: true
            - mountPath: /app
              name: app-storage
          workingDir: /app
        - name: build
          command:
            - sh
            - -c
            - nixpacks build . -o .
          image: ghcr.io/kubero-dev/build:latest
          imagePullPolicy: Always
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
              ephemeral-storage: 256Mi
            limits:
              cpu: "2"
              memory: 2Gi
              ephemeral-storage: 4Gi
          securityContext:
            privileged: false
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
          terminationMessagePath: /dev/termination-log
          terminationMessagePolicy: File
          volumeMounts:
            - mountPath: /app
              name: app-storage
          workingDir: /app
        - name: push
          command:
            - sh
            - -c
            - |-
              set -eu
              buildah --storage-driver=vfs build --isolation=chroot --tls-verify=true -f "$BUILDAH_DOCKERFILE_PATH" -t "$BUILD_IMAGE" .
              buildah --storage-driver=vfs push --tls-verify=true "$BUILD_IMAGE"
          env:
            - name: REGISTRY_AUTH_FILE
              value: /etc/buildah/auth/.dockerconfigjson
            - name: BUILD_IMAGE
              value: registry-kubero.yourdomain.com/optionalrepositoryowner/pipeline/app:123456
            - name: BUILDAH_DOCKERFILE_PATH
              value: /app/Dockerfile
          image: quay.io/containers/buildah:v1.35
          imagePullPolicy: IfNotPresent
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
              ephemeral-storage: 256Mi
            limits:
              cpu: "2"
              memory: 2Gi
              ephemeral-storage: 4Gi
          securityContext:
            privileged: false
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
              add:
                - CHOWN
                - DAC_OVERRIDE
                - FOWNER
                - FSETID
                - SETGID
                - SETUID
                - SETFCAP
                - SYS_CHROOT
                - MKNOD
                - SYS_ADMIN
            runAsUser: 0
          terminationMessagePath: /dev/termination-log
          terminationMessagePolicy: File
          volumeMounts:
            - mountPath: /app
              name: app-storage
              readOnly: true
            - mountPath: /etc/buildah/auth
              name: pull-secret
              readOnly: true
          workingDir: /app
      restartPolicy: Never
      schedulerName: default-scheduler
      serviceAccount: example-kuberoapp
      serviceAccountName: example-kuberoapp
      terminationGracePeriodSeconds: 30
      volumes:
        - name: deployment-keys
          secret:
            secretName: deployment-keys
        - emptyDir:
            sizeLimit: 4Gi
          name: app-storage
        - name: pull-secret
          secret:
            defaultMode: 384
            secretName: kubero-pull-secret
        - name: deploy-tmp
          emptyDir:
            sizeLimit: 64Mi
        - name: deploy-api-access
          projected:
            defaultMode: 420
            sources:
              - serviceAccountToken:
                  path: token
                  expirationSeconds: 3600
              - configMap:
                  name: kube-root-ca.crt
                  items:
                    - key: ca.crt
                      path: ca.crt
              - downwardAPI:
                  items:
                    - path: namespace
                      fieldRef:
                        apiVersion: v1
                        fieldPath: metadata.namespace
      hostUsers: false
  activeDeadlineSeconds: 1800
`;
