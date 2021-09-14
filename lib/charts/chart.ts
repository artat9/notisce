import { Chart } from "cdk8s";
import { Construct } from "constructs";
import { IntOrString, KubeDeployment, KubeService } from "../../imports/k8s";

export class NotisceChart extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    const app = "notisce";
    const selector = { app: app };

    new KubeService(this, "service", {
      spec: {
        ports: [{ port: 80, targetPort: IntOrString.fromNumber(8080) }],
        selector: selector,
      },
    });

    new KubeDeployment(this, "deployment", {
      spec: {
        replicas: 1,
        selector: {
          matchLabels: selector,
        },
        template: {
          metadata: {
            labels: selector,
          },
          spec: {
            containers: [
              {
                name: "app",
                image: `atatur9/${app}:latest`,
                ports: [{ containerPort: 8080 }],
              },
            ],
          },
        },
      },
    });
  }
}
