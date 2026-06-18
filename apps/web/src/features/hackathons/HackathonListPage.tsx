import { Rocket } from 'lucide-react';

export function HackathonListPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12 animate-in fade-in duration-500">
      <div className="text-center py-20">
        <Rocket className="w-16 h-16 mx-auto mb-6 text-[#666666]" />
        <h1 className="text-3xl font-bold mb-4">黑客松</h1>
        <p className="text-[#666666]">黑客松功能正在建设中，敬请期待...</p>
      </div>
    </div>
  );
}
