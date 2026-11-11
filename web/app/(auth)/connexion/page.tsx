import type { Metadata } from "next";
import { ConnexionView } from "./view";

export const metadata: Metadata = { title: "Connexion" };

export default function ConnexionPage() {
  return <ConnexionView />;
}
