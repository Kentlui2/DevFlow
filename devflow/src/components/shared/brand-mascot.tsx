import Image from "next/image";

export function BrandMascot({ className }: { className: string }) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={className}
      height={686}
      priority
      src="/brand/devflow-mascot.svg"
      width={981}
    />
  );
}
