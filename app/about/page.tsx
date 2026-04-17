import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-3xl flex-col justify-center px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">About</h1>

        <p className="mt-6 text-base leading-8 text-zinc-700">
          In Europe and the U.S., I’ve always struggled to find clothes that fit
          me well. The sleeves are almost always too long. I believe many Asian
          men living in the West face the same issue. I hope this site can solve
          this problem once and for all.
        </p>
      </main>
    </div>
  );
}
