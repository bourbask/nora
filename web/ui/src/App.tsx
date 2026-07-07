import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dashboard } from "@/pages/Dashboard";
import { FlowPortfolio } from "@/pages/FlowPortfolio";
import { Strategy } from "@/pages/Strategy";

export default function App() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">NORA</h1>
        <p className="text-sm text-muted-foreground">Net-wOrth · Reporting · Analytics</p>
      </header>

      <Tabs defaultValue="dashboard">
        <TabsList className="mb-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="flow">Flux &amp; Portefeuille</TabsTrigger>
          <TabsTrigger value="strategy">Stratégies</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><Dashboard /></TabsContent>
        <TabsContent value="flow"><FlowPortfolio /></TabsContent>
        <TabsContent value="strategy"><Strategy /></TabsContent>
      </Tabs>
    </div>
  );
}
