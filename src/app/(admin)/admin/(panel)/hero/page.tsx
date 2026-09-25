import { getStorefrontSettings } from "@/lib/storefrontSettings";
import HeroEditor from "./HeroEditor";

export default async function AdminHeroPage() {
  const settings = await getStorefrontSettings();

  return (
    <div className="p-6">
      <h1 className="font-display uppercase text-2xl text-navy">Hero Banner</h1>
      <p className="mt-1 text-sm text-muted">
        The big photo, headline and button at the top of the home page.
      </p>
      <div className="mt-6 max-w-6xl">
        <HeroEditor hero={settings.hero} />
      </div>
    </div>
  );
}
