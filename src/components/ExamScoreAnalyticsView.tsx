import React from 'react';
import {
  Trophy,
  Award,
  Users,
  CheckCircle,
  BarChart3,
  TrendingUp,
  Layers,
  Sparkles,
  PieChart
} from 'lucide-react';
import { ExamSession } from '../services/examSessionService';

interface ExamScoreAnalyticsViewProps {
  session: ExamSession;
  className: string;
}

export const ExamScoreAnalyticsView: React.FC<ExamScoreAnalyticsViewProps> = ({ session, className }) => {
  const subs = session.submissions;
  const scores = subs.map((s) => s.totalScore);
  const total = Math.max(1, subs.length);

  // Phân bố theo thang 1 điểm (0-1, 1-2, ..., 9-10)
  const scoreBuckets = Array.from({ length: 10 }, (_, i) => {
    const min = i;
    const max = i + 1;
    const count = scores.filter((sc) => (i === 9 ? sc >= min && sc <= max : sc >= min && sc < max)).length;
    const percent = Math.round((count / total) * 100);
    return {
      label: `${min} - ${max}đ`,
      count,
      percent,
    };
  });

  // Phân bố học lực
  const countGioi = scores.filter((sc) => sc >= 8.0).length;
  const countKha = scores.filter((sc) => sc >= 6.5 && sc < 8.0).length;
  const countTB = scores.filter((sc) => sc >= 5.0 && sc < 6.5).length;
  const countYeu = scores.filter((sc) => sc < 5.0).length;

  const percentGioi = Math.round((countGioi / total) * 100);
  const percentKha = Math.round((countKha / total) * 100);
  const percentTB = Math.round((countTB / total) * 100);
  const percentYeu = Math.round((countYeu / total) * 100);

  // Thống kê theo từng mã đề
  const variantStats = session.variantCodes.map((code) => {
    const vSubs = subs.filter((s) => s.examCode === code);
    const vScores = vSubs.map((s) => s.totalScore);
    const vCount = vSubs.length;
    const vAvg = vScores.length > 0 ? (vScores.reduce((a, b) => a + b, 0) / vScores.length).toFixed(2) : '—';
    const vMax = vScores.length > 0 ? Math.max(...vScores).toFixed(2) : '—';
    const vMin = vScores.length > 0 ? Math.min(...vScores).toFixed(2) : '—';
    const vPass = vScores.length > 0 ? Math.round((vScores.filter((sc) => sc >= 5.0).length / vScores.length) * 100) : 0;

    return {
      code,
      count: vCount,
      avg: vAvg,
      max: vMax,
      min: vMin,
      passRate: vPass,
    };
  });

  const maxBucketCount = Math.max(1, ...scoreBuckets.map((b) => b.count));

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 text-white p-6 rounded-3xl shadow-md border border-indigo-800/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                📈 PHỔ ĐIỂM & ĐÁNH GIÁ CHẤT LƯỢNG
              </span>
              <span className="text-xs text-indigo-300 font-mono">
                Lớp {className} • {session.submissions.length} Học Sinh
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black mt-1.5 text-white">
              Báo Cáo Phổ Điểm & So Sánh Mã Đề: {session.baseTitle}
            </h2>
            <p className="text-xs text-indigo-200 mt-1 max-w-2xl">
              Phân tích trực quan sự phân bố điểm số theo chuẩn thống kê giáo dục và kiểm chứng độ cân bằng giữa các mã đề thi.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center bg-white/10 p-3 rounded-2xl backdrop-blur-sm border border-white/20 shrink-0">
            <div>
              <div className="text-[10px] text-indigo-200 font-bold uppercase">Điểm TB Lớp</div>
              <div className="text-2xl font-black text-amber-300 mt-0.5">{session.avgScore}</div>
            </div>
            <div>
              <div className="text-[10px] text-indigo-200 font-bold uppercase">Tỷ Lệ Đạt</div>
              <div className="text-2xl font-black text-emerald-300 mt-0.5">{session.passRate}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. BIỂU ĐỒ PHỔ ĐIỂM (SCORE DISTRIBUTION HISTOGRAM) */}
      <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-black text-slate-900 uppercase">
              Phổ Điểm Toàn Lớp (Phân bố theo thang 1 điểm)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            {subs.length} bài thi được thống kê
          </span>
        </div>

        {/* Cột phổ điểm trực quan */}
        <div className="pt-4 pb-2">
          <div className="flex items-end justify-between gap-1.5 sm:gap-3 h-52 sm:h-60 border-b-2 border-slate-300 px-2">
            {scoreBuckets.map((bucket, bIdx) => {
              const heightPercent = Math.max(4, Math.round((bucket.count / maxBucketCount) * 100));
              const isHigh = bIdx >= 8;
              const isMid = bIdx >= 5 && bIdx < 8;

              return (
                <div key={bIdx} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <span className="text-[11px] font-black text-slate-700 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {bucket.count} em
                  </span>
                  <div
                    className={`w-full rounded-t-lg transition-all duration-300 relative ${
                      bucket.count === 0
                        ? 'bg-slate-100'
                        : isHigh
                        ? 'bg-gradient-to-t from-emerald-600 to-teal-400 group-hover:from-emerald-700 group-hover:to-teal-500 shadow-xs'
                        : isMid
                        ? 'bg-gradient-to-t from-indigo-600 to-blue-400 group-hover:from-indigo-700 group-hover:to-blue-500 shadow-xs'
                        : 'bg-gradient-to-t from-rose-500 to-amber-400 group-hover:from-rose-600 group-hover:to-amber-500 shadow-xs'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  >
                    {bucket.count > 0 && (
                      <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-black text-white drop-shadow">
                        {bucket.count}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 mt-2 text-center whitespace-nowrap">
                    {bucket.label.replace('đ', '')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4 Thang Học Lực */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-center">
            <span className="text-[11px] font-black uppercase text-emerald-800">Giỏi (8.0 - 10.0)</span>
            <div className="text-2xl font-black text-emerald-700 mt-0.5">{countGioi} em</div>
            <span className="text-xs font-bold text-emerald-600">{percentGioi}% cả lớp</span>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-2xl text-center">
            <span className="text-[11px] font-black uppercase text-blue-800">Khá (6.5 - 7.9)</span>
            <div className="text-2xl font-black text-blue-700 mt-0.5">{countKha} em</div>
            <span className="text-xs font-bold text-blue-600">{percentKha}% cả lớp</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-center">
            <span className="text-[11px] font-black uppercase text-slate-800">Trung Bình (5.0 - 6.4)</span>
            <div className="text-2xl font-black text-slate-700 mt-0.5">{countTB} em</div>
            <span className="text-xs font-bold text-slate-600">{percentTB}% cả lớp</span>
          </div>

          <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl text-center">
            <span className="text-[11px] font-black uppercase text-rose-800">Dưới TB (&lt;5.0)</span>
            <div className="text-2xl font-black text-rose-700 mt-0.5">{countYeu} em</div>
            <span className="text-xs font-bold text-rose-600">{percentYeu}% cả lớp</span>
          </div>
        </div>
      </div>

      {/* 3. SO SÁNH CHẤT LƯỢNG GIỮA CÁC MÃ ĐỀ (NẾU CÓ NHIỀU MÃ ĐỀ) */}
      {variantStats.length > 1 && (
        <div className="bg-white p-6 rounded-3xl border-2 border-purple-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-600" />
              <h3 className="text-base font-black text-slate-900 uppercase">
                Bảng So Sánh Điểm Giữa Các Mã Đề ({variantStats.length} mã đề trong đợt kiểm tra)
              </h3>
            </div>
            <span className="text-xs text-purple-700 font-semibold italic">
              Kiểm tra độ đồng đều về độ khó giữa các mã đề đảo câu
            </span>
          </div>

          <div className="border border-slate-300 rounded-2xl overflow-x-auto shadow-2xs">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-purple-950 text-white uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 text-center border-r border-purple-900 w-12">STT</th>
                  <th className="py-2.5 px-3 border-r border-purple-900 font-mono">MÃ ĐỀ</th>
                  <th className="py-2.5 px-3 text-center border-r border-purple-900">Số Học Sinh Làm</th>
                  <th className="py-2.5 px-3 text-center border-r border-purple-900 font-black bg-purple-900/60">
                    Điểm TB
                  </th>
                  <th className="py-2.5 px-3 text-center border-r border-purple-900 text-emerald-300">Cao Nhất</th>
                  <th className="py-2.5 px-3 text-center border-r border-purple-900 text-rose-300">Thấp Nhất</th>
                  <th className="py-2.5 px-3 text-center font-black bg-emerald-950 text-emerald-300">Tỷ Lệ Đạt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {variantStats.map((st, idx) => (
                  <tr key={st.code} className="hover:bg-purple-50/50 transition-colors">
                    <td className="py-2.5 px-3 text-center border-r border-slate-200 font-mono text-slate-600">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 font-mono font-black text-purple-900">
                      {st.code}
                    </td>
                    <td className="py-2.5 px-3 text-center border-r border-slate-200 font-bold">
                      {st.count} em
                    </td>
                    <td className="py-2.5 px-3 text-center border-r border-slate-200 font-black text-indigo-700 text-sm bg-indigo-50/40">
                      {st.avg}
                    </td>
                    <td className="py-2.5 px-3 text-center border-r border-slate-200 font-bold text-emerald-700">
                      {st.max}
                    </td>
                    <td className="py-2.5 px-3 text-center border-r border-slate-200 font-bold text-rose-700">
                      {st.min}
                    </td>
                    <td className="py-2.5 px-3 text-center font-black text-emerald-700 bg-emerald-50/40">
                      {st.passRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
