import { SubnetType, Vpc } from "@aws-cdk/aws-ec2";
import {
  Cluster,
  ContainerImage,
  FargateService,
  FargateTaskDefinition,
  LogDriver,
} from "@aws-cdk/aws-ecs";
import { ManagedPolicy, Role, ServicePrincipal } from "@aws-cdk/aws-iam";
import { LogGroup } from "@aws-cdk/aws-logs";
import * as cdk from "@aws-cdk/core";
import { RemovalPolicy } from "@aws-cdk/core";
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
    const executionRole = new Role(this, "EcsTaskExecutionRole", {
      roleName: "notisce-ecs-task-execution-role",
      assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
    });
    const serviceTaskRole = new Role(this, "EcsServiceTaskRole", {
      roleName: "notisce-ecs-service-task-role",
      assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com"),
    });
    basicPolicytStatements(this.region, this.account).forEach((s) =>
      serviceTaskRole.addToPolicy(s)
    );
    const logGroup = new LogGroup(this, "ServiceLogGroup", {
      logGroupName: "/aws/ecs/notisce-cluster",
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const image = ContainerImage.fromAsset(".");
    const cpu = 256;
    const mem = 1024;
    const taskDef = new FargateTaskDefinition(this, "ServiceTaskDefinition", {
      cpu: cpu,
      memoryLimitMiB: mem,
      executionRole: executionRole,
      taskRole: serviceTaskRole,
    });
    taskDef.addContainer("ContainerDef", {
      image,
      cpu: cpu,
      memoryLimitMiB: mem,
      logging: LogDriver.awsLogs({
        streamPrefix: "notisce",
        logGroup,
      }),
    });
    const cluster = new Cluster(this, "notisce-cluster", {
      clusterName: "notisce-cluster",
      containerInsights: true,
      vpc: vpc,
      enableFargateCapacityProviders: true,
    });
    const fargateService = new FargateService(this, "FargateService", {
      cluster,
      vpcSubnets: vpc.selectSubnets({ subnetType: SubnetType.PRIVATE }),
      taskDefinition: taskDef,
      desiredCount: 1,
    });
    //const eksRole = new Role(this, "eksRole", {
    //  assumedBy: new ServicePrincipal("eks.amazonaws.com"),
    //});
    //eksRole.addManagedPolicy(
    //  ManagedPolicy.fromAwsManagedPolicyName("AmazonEKSClusterPolicy")
    //);
    //eksRole.addManagedPolicy(
    //  ManagedPolicy.fromAwsManagedPolicyName("AmazonEKSServicePolicy")
    //);
    //basicPolicytStatements(this.region, this.account).forEach((s) =>
    //  eksRole.addToPolicy(s)
    //);
    //new Repository(this, "notisce-repository", {
    //  imageScanOnPush: true,
    //  imageTagMutability: TagMutability.MUTABLE,
    //  repositoryName: "notisce",
    //  removalPolicy: RemovalPolicy.DESTROY,
    //});
    //const cluster = new Cluster(this, "cluster", {
    //  vpc,
    //  mastersRole: eksRole,
    //  clusterName: "notisce-subscriber",
    //  version: KubernetesVersion.V1_21,
    //  role: eksRole,
    //  defaultCapacity: 1,
    //  defaultCapacityInstance: InstanceType.of(
    //    InstanceClass.T2,
    //    InstanceSize.MEDIUM
    //  ),
    //  vpcSubnets: [
    //    {
    //      subnets: vpc.privateSubnets,
    //    },
    //  ],
    //});
    //cluster.addCdk8sChart(
    //  "chart",
    //  new NotisceChart(new cdk8s.App(), "notisce-chart")
    //);
    //const admin = User.fromUserName(this, "masterUser", "yushi");
    //cluster.awsAuth.addUserMapping(admin, { groups: ["system:masters"] });
    //setupClusterLogging(this, cluster);
  }
}
//const setupClusterLogging = (
//  stack: cdk.Stack,
//  cluster: FargateCluster
//): void => {
//  new AwsCustomResource(stack, "ClusterLogsEnabler", {
//    policy: AwsCustomResourcePolicy.fromSdkCalls({
//      resources: [`${cluster.clusterArn}/update-config`],
//    }),
//    onCreate: {
//      physicalResourceId: { id: `${cluster.clusterArn}/LogsEnabler` },
//      service: "EKS",
//      action: "updateClusterConfig",
//      region: stack.region,
//      parameters: {
//        name: cluster.clusterName,
//        logging: {
//          clusterLogging: [
//            {
//              enabled: true,
//              types: [
//                "api",
//                "audit",
//                "authenticator",
//                "controllerManager",
//                "scheduler",
//              ],
//            },
//          ],
//        },
//      },
//    },
//    onDelete: {
//      physicalResourceId: { id: `${cluster.clusterArn}/LogsEnabler` },
//      service: "EKS",
//      action: "updateClusterConfig",
//      region: stack.region,
//      parameters: {
//        name: cluster.clusterName,
//        logging: {
//          clusterLogging: [
//            {
//              enabled: false,
//              types: [
//                "api",
//                "audit",
//                "authenticator",
//                "controllerManager",
//                "scheduler",
//              ],
//            },
//          ],
//        },
//      },
//    },
//  });
//};
