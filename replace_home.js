const fs = require('fs');
const file = 'App.tsx';
let content = fs.readFileSync(file, 'utf8');

const startIdx = content.indexOf('const HomePage = () => (');
const endIdx = content.indexOf('const AllDegreesPage = () => (');

if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find HomePage or AllDegreesPage markers');
    process.exit(1);
}

const newHome = `const HomePage = () => (
    <div className="animate-in fade-in duration-700 pb-20 bg-[#F5F4F0]">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-transparent border-b border-[#171717]">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
          <div className="col-span-1 lg:col-span-2 p-8 md:p-16 lg:p-24 border-b lg:border-b-0 lg:border-r border-[#171717] bg-[#F5F4F0] flex flex-col justify-center">
            <div className="inline-block mb-8 w-fit"><span className="inline-flex items-center px-3 py-1 rounded-full border border-[#171717] bg-[#171717] text-[#F5F4F0] text-[10px] font-black uppercase tracking-widest">OpenCSG Academy</span></div>
            <h1 className="text-6xl md:text-8xl lg:text-[100px] font-black leading-[0.9] text-[#171717] tracking-tighter mb-8 uppercase">
              MASTER AI.<br />OWN THE FUTURE.
            </h1>
            <p className="text-xl md:text-2xl text-[#666666] max-w-2xl leading-relaxed mb-12 font-medium">
              从 Prompt 工程到 Agent 开发，从模型微调到企业级应用。体系化 AI 课程 + 实战项目 + 智能助教。
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={() => navTo(ViewState.ALL_DEGREES)} className="bg-[#171717] text-white px-8 py-5 font-bold text-lg hover:bg-black transition-colors rounded-none border border-[#171717] uppercase tracking-wider">探索 Nano Degree</button>
              <button onClick={() => navTo(ViewState.ALL_COURSES)} className="bg-transparent text-[#171717] px-8 py-5 font-bold text-lg hover:bg-[#EEEDE9] transition-colors rounded-none border border-[#171717] uppercase tracking-wider">浏览所有课程</button>
            </div>
          </div>
          <div className="col-span-1 flex flex-col">
            <div className="flex-1 p-8 lg:p-12 border-b border-[#171717] bg-white flex flex-col justify-center">
              <div className="text-xs font-black tracking-widest text-[#999999] uppercase mb-4">Users</div>
              <div className="text-7xl lg:text-8xl font-black text-[#171717] tracking-tighter">10K+</div>
              <p className="text-[#171717] font-bold uppercase tracking-widest mt-2 text-xs">全球学习者</p>
            </div>
            <div className="flex-1 p-8 lg:p-12 bg-[#F5F4F0] flex flex-col justify-center">
              <div className="text-xs font-black tracking-widest text-[#999999] uppercase mb-4">Courses</div>
              <div className="text-7xl lg:text-8xl font-black text-[#171717] tracking-tighter">50+</div>
              <p className="text-[#171717] font-bold uppercase tracking-widest mt-2 text-xs">专业内容</p>
            </div>
          </div>
        </div>
      </section>

      {/* DEGREES SECTION */}
      <section className="max-w-[1600px] mx-auto px-0 py-0 border-b border-[#171717]">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
          <div className="col-span-1 lg:col-span-3 p-8 border-b border-[#171717] bg-[#171717] flex items-center justify-between">
            <h2 className="text-3xl md:text-5xl font-black text-[#F5F4F0] tracking-tighter uppercase">热门职业路径</h2>
            <button onClick={() => navTo(ViewState.ALL_DEGREES)} className="hidden md:flex items-center gap-2 text-[#171717] font-bold tracking-widest uppercase text-sm border border-[#171717] bg-[#F5F4F0] px-4 py-2 hover:bg-white transition-colors">VIEW ALL <ChevronRight className="w-4 h-4" /></button>
          </div>
          {degrees.slice(0, 3).map((degree, index) => (
            <div key={degree.id} className={\`col-span-1 border-[#171717] p-8 lg:p-12 bg-white flex flex-col group cursor-pointer hover:bg-[#F5F4F0] transition-colors \${index !== 2 ? 'border-b lg:border-b-0 lg:border-r' : ''}\`} onClick={() => handleDegreeClick(degree.id)}>
              <div className="flex justify-between items-start mb-12">
                <div className="p-4 border border-[#171717] bg-[#171717] text-[#F5F4F0]">{ICON_MAP[degree.icon] || ICON_MAP['shield']}</div>
                <span className="px-3 py-1 border border-[#171717] text-[10px] font-black uppercase tracking-widest">{degree.courses.length} CORE COURSES</span>
              </div>
              <h3 className="text-3xl font-black text-[#171717] mb-4 tracking-tighter uppercase leading-none">{degree.title}</h3>
              <p className="text-[#666666] mb-12 flex-grow font-medium leading-relaxed">{degree.description}</p>
              <div className="flex justify-between items-end border-t border-[#171717] pt-8 mt-auto">
                <div><div className="text-[10px] text-[#999999] uppercase font-black mb-1 tracking-widest">Investment</div><span className="text-3xl font-black text-[#171717]">¥{degree.price}</span></div>
                <ArrowRight className="w-8 h-8 text-[#171717] group-hover:translate-x-2 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS SECTION */}
      <section className="bg-[#171717] text-white border-b border-[#171717]">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="p-12 lg:p-24 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-[#262626]">
            <h2 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter uppercase leading-none">THEY BUILT<br/>THE FUTURE</h2>
            <p className="text-[#A3A3A3] font-medium text-xl leading-relaxed">加入超过 10,000 名终身学习者的社区</p>
          </div>
          <div className="flex flex-col">
            {[
              { name: "李明", role: "前端工程师", text: "OpenCSG 的课程非常实战。我以前完全不懂代码，跟着'全栈创作者'路径学完后，我成功拿到了第一份开发 Offer。", icon: <Code2 /> },
              { name: "Sarah Wang", role: "数据分析师", text: "这里的 AI 助教太棒了！无论多晚，遇到问题都能立刻得到解答，就像有个私人导师在身边。", icon: <Sparkles /> }
            ].map((item, idx) => (
              <div key={idx} className={\`p-8 lg:p-12 relative flex flex-col justify-between \${idx === 0 ? 'border-b border-[#262626]' : ''}\`}>
                <Quote className="absolute top-8 right-8 text-[#262626] w-16 h-16" />
                <p className="text-2xl font-bold leading-relaxed mb-8 relative z-10">"{item.text}"</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 border border-[#262626] flex items-center justify-center text-white">{item.icon}</div>
                  <div><div className="font-black uppercase tracking-widest">{item.name}</div><div className="text-xs text-[#A3A3A3] uppercase tracking-widest font-bold">{item.role}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SINGLE COURSES SECTION */}
      <section className="max-w-[1600px] mx-auto px-0 py-0 border-b border-[#171717] bg-[#F5F4F0]">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-0">
          <div className="col-span-1 lg:col-span-4 p-8 border-b border-[#171717] bg-white flex items-center justify-between">
            <h2 className="text-3xl md:text-5xl font-black text-[#171717] tracking-tighter uppercase">探索单项技能</h2>
            <button onClick={() => navTo(ViewState.ALL_COURSES)} className="hidden md:flex items-center gap-2 text-[#F5F4F0] font-bold tracking-widest uppercase text-sm border border-[#171717] bg-[#171717] px-4 py-2 hover:bg-black transition-colors">VIEW ALL <ChevronRight className="w-4 h-4" /></button>
          </div>
          {courses.slice(0, 4).map((course, index) => (
            <div key={course.id} onClick={() => handleCourseClick(course.id)} className={\`col-span-1 border-[#171717] bg-white flex flex-col group cursor-pointer hover:bg-[#EEEDE9] transition-colors \${index !== 3 ? 'border-b lg:border-b-0 lg:border-r' : ''}\`}>
              <div className="h-48 overflow-hidden relative border-b border-[#171717]">
                <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                <div className="absolute top-4 right-4"><CostBadge type={course.costType} /></div>
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <div className="flex items-center justify-between text-[10px] font-black tracking-widest uppercase text-[#999999] mb-4">
                  <div className="flex items-center gap-1"><Clock size={12}/> {course.duration}</div>
                  <div className="flex items-center gap-1"><UserIcon size={12}/> {course.instructor}</div>
                </div>
                <h3 className="text-xl font-black text-[#171717] leading-tight mb-4 uppercase">{course.title}</h3>
                <p className="text-[13px] text-[#666666] line-clamp-2 flex-grow mb-6 font-medium leading-relaxed">{course.description}</p>
                <div className="pt-6 border-t border-[#171717] flex items-center justify-between">
                  <span className={\`text-[10px] font-black tracking-widest uppercase px-2 py-1 border \${course.level === 'Beginner' ? 'border-[#171717] text-[#171717]' : 'bg-[#171717] border-[#171717] text-[#F5F4F0]'}\`}>{course.level === 'Beginner' ? '入门' : '进阶'}</span>
                  {course.costType === 'paid' ? (
                    <div className="flex items-center gap-2">
                      {!currentUser && <Lock className="w-3 h-3 text-[#171717]" />}
                      <span className="text-[#171717] font-black text-lg">¥{course.price}</span>
                    </div>
                  ) : <span className="text-[#171717] text-xs font-black tracking-widest uppercase group-hover:underline">DETAILS →</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA SECTION */}
      {!currentUser && (
        <section className="bg-white border-b border-[#171717]">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-12 lg:p-24 border-b lg:border-b-0 lg:border-r border-[#171717] bg-[#171717] text-white flex flex-col justify-center">
              <div className="inline-block mb-8 w-fit"><span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 bg-white/10 text-white text-[10px] font-black uppercase tracking-widest"><Sparkles size={12} /> 限时免费</span></div>
              <h2 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter uppercase leading-none">开启你的<br/>学习之旅</h2>
              <p className="text-[#A3A3A3] font-medium text-lg leading-relaxed mb-12">
                注册即可免费访问所有免费课程，获取学习进度追踪、AI 助教辅导、社区讨论等完整功能。
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={() => setIsLoginModalOpen(true)} className="bg-white text-[#171717] px-8 py-5 font-bold text-lg hover:bg-[#EEEDE9] transition-colors rounded-none border border-white uppercase tracking-wider">立即免费注册</button>
                <button onClick={() => navTo(ViewState.ALL_COURSES)} className="bg-transparent text-white px-8 py-5 font-bold text-lg hover:bg-white/10 transition-colors rounded-none border border-white uppercase tracking-wider">先看看课程</button>
              </div>
            </div>
            <div className="p-12 lg:p-24 bg-[#F5F4F0] flex flex-col justify-center">
              <div className="border border-[#171717] bg-white p-8 mb-8">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-16 h-16 bg-[#171717] flex items-center justify-center">
                    <GraduationCap className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <div className="text-[#171717] text-4xl font-black tracking-tighter">10,000+</div>
                    <div className="text-[#999999] text-xs font-black uppercase tracking-widest mt-1">学员已加入</div>
                  </div>
                </div>
                <div className="space-y-4">
                  {['完成安全基础课程', '获得第一个认证', '加入学习小组'].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-[13px] text-[#171717] font-bold uppercase tracking-widest border-b border-[#EEEDE9] pb-4 last:border-0 last:pb-0">
                      <CheckCircle2 className="w-5 h-5 text-[#171717]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
`;

const newContent = content.substring(0, startIdx) + newHome + '\n\n' + content.substring(endIdx);
fs.writeFileSync(file, newContent, 'utf8');
console.log('HomePage replaced successfully');
