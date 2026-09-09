import Link from "next/link";
import { Button } from "@/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Button asChild>
        <Link href="/home">Back to Home</Link>
      </Button>
    </div>
  );
}
