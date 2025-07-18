import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/useI18n";
import { WbSunny, Business, Engineering, Receipt } from "@mui/icons-material";

export default function Landing() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mr-4">
              <WbSunny className="text-white text-2xl" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">SCAC Platform</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Automatisierung von Solarpanel-Installationsprojekten, Verwaltung von Rechnungen, Brigaden und Firmen
          </p>
          <Button
            size="lg"
            onClick={() => window.location.href = '/api/login'}
            className="bg-primary hover:bg-primary-dark text-white px-8 py-3 rounded-lg text-lg"
          >
            Anmelden
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <Card className="text-center">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Engineering className="text-primary" />
              </div>
              <CardTitle className="text-lg">Projektverwaltung</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Verwalten Sie Solarpanel-Installationsprojekte von der Planung bis zur Fertigstellung
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Receipt className="text-green-600" />
              </div>
              <CardTitle className="text-lg">Rechnungsstellung</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Automatische Rechnungserstellung und Integration mit Invoice Ninja
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Business className="text-purple-600" />
              </div>
              <CardTitle className="text-lg">Multi-Mandant</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Unterstützung mehrerer Firmen mit separaten Daten und Zugriffskontrollen
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <WbSunny className="text-orange-600" />
              </div>
              <CardTitle className="text-lg">Brigaden-Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Verwalten Sie Installationsbrigaden und weisen Sie sie Projekten zu
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
