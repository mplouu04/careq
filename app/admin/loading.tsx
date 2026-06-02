export default function AdminLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8f9fa" }}>
      <div className="text-center">
        <div className="animate-spin w-10 h-10 border-4 border-[#0d6efd] border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-500 text-sm">Loading admin panel...</p>
      </div>
    </div>
  );
}
