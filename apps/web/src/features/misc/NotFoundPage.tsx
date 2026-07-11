import { Link } from 'react-router-dom';
import { ArrowUpRight, Home } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-[#F5F4F0] text-[#171717] px-6">
      <div className="max-w-3xl w-full">
        <div className="border-2 border-[#171717] bg-white">
          <div className="bg-[#171717] text-white p-8 md:p-12">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-3">
              / 404
            </div>
            <div className="text-[10rem] md:text-[14rem] font-black tracking-tighter leading-none">
              404
            </div>
          </div>
          <div className="p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase leading-none mb-4">
              Page Not Found
            </h1>
            <p className="text-[#666666] mb-8 leading-relaxed max-w-md">
              抱歉，你访问的页面不存在。可能是链接已失效，或者你输入的地址有误。
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/"
                className="inline-flex items-center justify-between gap-6 bg-[#171717] text-white px-6 py-4 font-black uppercase tracking-wider text-sm hover:bg-[#262626] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Home className="w-4 h-4" /> Back To Home
                </span>
                <ArrowUpRight className="w-4 h-4" />
              </Link>
              <Link
                to="/courses"
                className="inline-flex items-center justify-between gap-6 border border-[#171717] text-[#171717] px-6 py-4 font-black uppercase tracking-wider text-sm hover:bg-[#EEEDE9] transition-colors"
              >
                <span>Browse Courses</span>
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
