export interface CertificationInfo {
  name: string;
  logo: string;
  url: string;
}

export const certificationLogos: Record<string, CertificationInfo> = {
  "OEKO-TEX Standard 100": {
    name: "OEKO-TEX Standard 100",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Oeko-tex-logo.svg/200px-Oeko-tex-logo.svg.png",
    url: "https://www.oeko-tex.com/en/our-standards/oeko-tex-standard-100"
  },
  "GOTS": {
    name: "GOTS (Global Organic Textile Standard)",
    logo: "https://global-standard.org/images/GOTS-logo/GOTS_logo_RGB_650.png",
    url: "https://global-standard.org/"
  },
  "BSCI": {
    name: "BSCI (Business Social Compliance Initiative)",
    logo: "https://amfori.org/sites/default/files/amfori-bsci-logo.png",
    url: "https://www.amfori.org/content/amfori-bsci"
  },
  "ISO": {
    name: "ISO Certified",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/ISO_Logo_%28Red_square%29.svg/200px-ISO_Logo_%28Red_square%29.svg.png",
    url: "https://www.iso.org/"
  },
  "FSC": {
    name: "FSC (Forest Stewardship Council)",
    logo: "https://upload.wikimedia.org/wikipedia/en/thumb/c/cf/Forest_Stewardship_Council_Logo.svg/200px-Forest_Stewardship_Council_Logo.svg.png",
    url: "https://fsc.org/"
  },
  "CE": {
    name: "CE Marking",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/CE_Logo.svg/200px-CE_Logo.svg.png",
    url: "https://ec.europa.eu/growth/single-market/ce-marking_en"
  },
  "RoHS": {
    name: "RoHS Compliant",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/RoHS_Logo.svg/200px-RoHS_Logo.svg.png",
    url: "https://ec.europa.eu/environment/topics/waste-and-recycling/rohs-directive_en"
  },
  "Energy Star": {
    name: "ENERGY STAR",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Energy_Star_logo.svg/200px-Energy_Star_logo.svg.png",
    url: "https://www.energystar.gov/"
  },
  "CertiPUR-US": {
    name: "CertiPUR-US",
    logo: "https://certipur.us/wp-content/uploads/2021/04/certipur-us-logo-1.png",
    url: "https://certipur.us/"
  }
};

export function getCertificationInfo(certName: string): CertificationInfo | null {
  return certificationLogos[certName] || null;
}
