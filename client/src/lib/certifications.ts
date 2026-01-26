import oekoTexLogo from "@assets/certifications/oeko-tex.png";
import gotsLogo from "@assets/certifications/gots.png";
import bsciLogo from "@assets/certifications/bsci.png";
import isoLogo from "@assets/certifications/iso.png";
import iso14001Logo from "@assets/certifications/iso14001.png";
import fscLogo from "@assets/certifications/fsc.png";
import ceLogo from "@assets/certifications/ce.png";
import rohsLogo from "@assets/certifications/rohs.png";
import energyStarLogo from "@assets/certifications/energy-star.png";
import certipurUsLogo from "@assets/certifications/certipur-us.png";

export interface CertificationInfo {
  name: string;
  logo: string;
  url: string;
}

export const certificationLogos: Record<string, CertificationInfo> = {
  "OEKO-TEX Standard 100": {
    name: "OEKO-TEX Standard 100",
    logo: oekoTexLogo,
    url: "https://www.oeko-tex.com/en/our-standards/oeko-tex-standard-100"
  },
  "GOTS": {
    name: "GOTS (Global Organic Textile Standard)",
    logo: gotsLogo,
    url: "https://global-standard.org/"
  },
  "BSCI": {
    name: "BSCI (Business Social Compliance Initiative)",
    logo: bsciLogo,
    url: "https://www.amfori.org/content/amfori-bsci"
  },
  "ISO": {
    name: "ISO 9001 Certified",
    logo: isoLogo,
    url: "https://www.iso.org/"
  },
  "ISO 14001": {
    name: "ISO 14001 Environmental Management",
    logo: iso14001Logo,
    url: "https://www.iso.org/iso-14001-environmental-management.html"
  },
  "FSC": {
    name: "FSC (Forest Stewardship Council)",
    logo: fscLogo,
    url: "https://fsc.org/"
  },
  "CE": {
    name: "CE Marking",
    logo: ceLogo,
    url: "https://ec.europa.eu/growth/single-market/ce-marking_en"
  },
  "RoHS": {
    name: "RoHS Compliant",
    logo: rohsLogo,
    url: "https://ec.europa.eu/environment/topics/waste-and-recycling/rohs-directive_en"
  },
  "Energy Star": {
    name: "ENERGY STAR",
    logo: energyStarLogo,
    url: "https://www.energystar.gov/"
  },
  "CertiPUR-US": {
    name: "CertiPUR-US",
    logo: certipurUsLogo,
    url: "https://certipur.us/"
  }
};

export function getCertificationInfo(certName: string): CertificationInfo | null {
  return certificationLogos[certName] || null;
}
