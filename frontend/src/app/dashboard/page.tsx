import UploadBOQ from "@/app/components/UploadBOQ";
import Report from "@/app/components/Report";

export default function Home() {
  return (
    <main className="container mx-auto p-4">
      <header className="text-center my-8">
        <h1 className="text-4xl font-bold">Construction Cost and Revenue Analysis</h1>
        <p className="text-xl text-gray-600 mt-2">Upload your Bill of Quantities (BOQ) to get started</p>
      </header>
      <div className="max-w-xl mx-auto">
        <UploadBOQ />
        <Report />
      </div>
    </main>
  );
}
