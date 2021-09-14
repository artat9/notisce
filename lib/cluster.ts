import {
  InstanceClass,
  InstanceSize,
  InstanceType,
  SubnetType,
  Vpc,
} from "@aws-cdk/aws-ec2";
import { Repository, TagMutability } from "@aws-cdk/aws-ecr";
import { Cluster, FargateCluster, KubernetesVersion } from "@aws-cdk/aws-eks";
import { ManagedPolicy, Role, ServicePrincipal, User } from "@aws-cdk/aws-iam";
import * as cdk from "@aws-cdk/core";
import { RemovalPolicy } from "@aws-cdk/core";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
} from "@aws-cdk/custom-resources";
import * as cdk8s from "cdk8s";
import { NotisceChart } from "./charts/chart";
import { basicPolicytStatements } from "./restapi";

export class ClusterStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const vpc = new Vpc(this, "vpc", {
      cidr: "192.168.0.0/16",
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "Public1",
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "Public2",
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "Private1",
          subnetType: SubnetType.PRIVATE,
        },
        {
          cidrMask: 24,
          name: "Private2",
          subnetType: SubnetType.PRIVATE,
        },
      ],
    });

    const eksRole = new Role(this, "eksRole", {
      assumedBy: new ServicePrincipal("eks.amazonaws.com"),
    });
    eksRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("AmazonEKSClusterPolicy")
    );
    eksRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("AmazonEKSServicePolicy")
    );
    basicPolicytStatements(this.region, this.account).forEach((s) =>
      eksRole.addToPolicy(s)
    );
    new Repository(this, "notisce-repository", {
      imageScanOnPush: true,
      imageTagMutability: TagMutability.MUTABLE,
      repositoryName: "notisce",
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const cluster = new Cluster(this, "cluster", {
      vpc,
      mastersRole: eksRole,
      clusterName: "notisce-subscriber",
      version: KubernetesVersion.V1_21,
      role: eksRole,
      defaultCapacity: 1,
      defaultCapacityInstance: InstanceType.of(
        InstanceClass.T2,
        InstanceSize.MEDIUM
      ),
      vpcSubnets: [
        {
          subnets: vpc.privateSubnets,
        },
      ],
    });
    cluster.addCdk8sChart(
      "chart",
      new NotisceChart(new cdk8s.App(), "notisce-chart")
    );
    const admin = User.fromUserName(this, "masterUser", "yushi");
    cluster.awsAuth.addUserMapping(admin, { groups: ["system:masters"] });
    //setupClusterLogging(this, cluster);
  }
}
const setupClusterLogging = (
  stack: cdk.Stack,
  cluster: FargateCluster
): void => {
  new AwsCustomResource(stack, "ClusterLogsEnabler", {
    policy: AwsCustomResourcePolicy.fromSdkCalls({
      resources: [`${cluster.clusterArn}/update-config`],
    }),
    onCreate: {
      physicalResourceId: { id: `${cluster.clusterArn}/LogsEnabler` },
      service: "EKS",
      action: "updateClusterConfig",
      region: stack.region,
      parameters: {
        name: cluster.clusterName,
        logging: {
          clusterLogging: [
            {
              enabled: true,
              types: [
                "chart",
                "audit",
                "authenticator",
                "controllerManager",
                "scheduler",
              ],
            },
          ],
        },
      },
    },
    onDelete: {
      physicalResourceId: { id: `${cluster.clusterArn}/LogsEnabler` },
      service: "EKS",
      action: "updateClusterConfig",
      region: stack.region,
      parameters: {
        name: cluster.clusterName,
        logging: {
          clusterLogging: [
            {
              enabled: false,
              types: [
                "api",
                "audit",
                "authenticator",
                "controllerManager",
                "scheduler",
              ],
            },
          ],
        },
      },
    },
  });
};
