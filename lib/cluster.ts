import {
  InstanceClass,
  InstanceSize,
  InstanceType,
  SubnetType,
  Vpc,
} from "@aws-cdk/aws-ec2";
import { Cluster, KubernetesVersion } from "@aws-cdk/aws-eks";
import { ManagedPolicy, Role, ServicePrincipal } from "@aws-cdk/aws-iam";
import * as cdk from "@aws-cdk/core";
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
  }
}
