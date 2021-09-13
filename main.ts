import { App } from "cdk8s";
import { NotisceChart } from "./lib/charts/chart";

const app = new App();
new NotisceChart(app, "notisce-chart");
app.synth();
