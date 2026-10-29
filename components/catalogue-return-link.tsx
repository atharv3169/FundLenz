import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Always navigate directly to the Portfolio Lab, even from an external entry. */
export function CatalogueReturnLink() {
  return (
    <Link href="/" className="catalog-return-link">
      <ArrowLeft size={16} aria-hidden="true" />
      Back to Portfolio Lab
    </Link>
  );
}
