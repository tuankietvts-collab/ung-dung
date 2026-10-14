import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  TrendingUp,
  BarChart3,
  Award,
  ChevronDown,
  ChevronUp,
  Info,
  BookOpen,
  Sparkles,
  PieChart
} from 'lucide-react';
import { ExamSession, computeItemAnalysis, QuestionAnalysis } from '../services/examSessionService';
import { MathRenderer } from './MathRenderer';

interface ExamItemAnalysisViewProps {
  session: ExamSession;
  className: string;
}

export const ExamItemAnalysisView: React.FC<ExamItemAnalysisViewProps> = ({ session, className }) => {
  const [filterPart, setFilterPart] = useState<'all' | 'I' | 'II' | 'III'>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<'all' | 'hard' | 'medium' | 'easy'>('all');
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  const { analyses, topFailedQuestions, summary } = computeItemAnalysis(session);

  // Lọc câu hỏi theo bộ lọc
  const filteredAnalyses = analyses.filter((item) => {
    if (filterPart !== 'all' && item.part !== filterPart) return false;
    if (filterDifficulty === 'hard' && !['Khó / Sai nhiều', 'Phân hóa'].includes(item.difficultyLabel)) return false;
    if (filterDifficulty === 'medium' && item.difficultyLabel !== 'Trung bình') return false;
    if (filterDifficulty === 'easy' && item.difficultyLabel !== 'Dễ') return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Summary */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 rounded-3xl shadow-md border border-indigo-700/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-indigo-950 shadow-xs">
                📊 PHÂN TÍCH ĐỀ & CÂU HỎI (ITEM ANALYSIS)
              </span>
              <span className="text-xs text-indigo-200 font-mono">
                Lớp {className} • {session.submissions.length} Bài Thi Đã Nộp
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black mt-2 text-white">
              Thống Kê Chi Tiết Từng Câu Hỏi Đúng / Sai (Đợt Kiểm Tra: {session.baseTitle})
            </h2>
            <p className="text-xs sm:text-sm text-indigo-200 mt-1 max-w-3xl leading-relaxed">
              Hệ thống tự động tổng hợp câu trả lời từ tất cả các mã đề ({session.variantCodes.length > 0 ? session.variantCodes.join(', ') : 'Mã đề gốc'}) để đo lường độ khó, tỷ lệ học sinh làm đúng/sai và các câu hỏi bẫy cần chữa bài trên lớp.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 shrink-0">
            <div className="text-center">
              <div className="text-[11px] text-indigo-200 font-bold uppercase">Độ Đúng Toàn Bài</div>
              <div className="text-3xl font-black text-amber-300 mt-0.5">{summary.overallAccuracy}%</div>
              <div className="text-[10px] text-emerald-300 font-semibold">
                {summary.overallAccuracy >= 70 ? '✓ Đạt chuẩn chương trình' : '⚠ Cần củng cố thêm'}
              </div>
            </div>
          </div>
        </div>

        {/* 4 Chỉ số tóm tắt */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-indigo-700/60 text-xs">
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/10">
            <span className="text-indigo-200 block text-[11px]">Tổng số câu hỏi</span>
            <span className="text-xl font-black text-white mt-0.5 block">{summary.totalQuestions} câu</span>
            <span className="text-[10px] text-indigo-300">
              {summary.mcCount} TN • {summary.tfCount} Đúng/Sai • {summary.essayCount} Tự luận
            </span>
          </div>

          <div className="bg-emerald-950/40 backdrop-blur-sm p-3 rounded-xl border border-emerald-500/30">
            <span className="text-emerald-300 block text-[11px]">Câu làm tốt (Dễ ≥80%)</span>
            <span className="text-xl font-black text-emerald-300 mt-0.5 block">{summary.easyCount} câu</span>
            <span className="text-[10px] text-emerald-200">Học sinh nắm rất vững</span>
          </div>

          <div className="bg-sky-950/40 backdrop-blur-sm p-3 rounded-xl border border-sky-500/30">
            <span className="text-sky-300 block text-[11px]">Câu trung bình (60-80%)</span>
            <span className="text-xl font-black text-sky-300 mt-0.5 block">{summary.mediumCount} câu</span>
            <span className="text-[10px] text-sky-200">Độ phân hóa tốt</span>
          </div>

          <div className="bg-rose-950/40 backdrop-blur-sm p-3 rounded-xl border border-rose-500/30">
            <span className="text-rose-300 block text-[11px]">Câu sai nhiều (&lt;60%)</span>
            <span className="text-xl font-black text-rose-300 mt-0.5 block">{summary.hardCount} câu</span>
            <span className="text-[10px] text-rose-200">Cần giáo viên chữa trên lớp</span>
          </div>
        </div>
      </div>

      {/* 2. CẢNH BÁO NỔI BẬT: TOP CÁC CÂU HỌC SINH SAI NHIỀU NHẤT (CẦN CHỮA BÀI) */}
      {topFailedQuestions.length > 0 && (
        <div className="bg-amber-50/90 border-2 border-amber-300 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500 text-white">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-black text-amber-950 uppercase tracking-tight">
                  Top Câu Hỏi Học Sinh Sai Nhiều Nhất (Thầy/Cô Cần Chữa Bài)
                </h3>
                <p className="text-xs text-amber-800">
                  Đây là những câu hỏi có tỷ lệ học sinh làm sai cao nhất trong đợt kiểm tra này.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-200 text-amber-900 border border-amber-300">
              {topFailedQuestions.length} Câu trọng tâm
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {topFailedQuestions.map((q) => {
              const failRate = 100 - q.correctRate;
              return (
                <div
                  key={`top-fail-${q.questionId}`}
                  className="bg-white p-4 rounded-2xl border-2 border-amber-200 shadow-2xs hover:border-amber-400 transition-all flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                        {q.part === 'I' ? `Câu ${q.questionIndex} (Phần I)` : q.part === 'II' ? `Câu ${q.questionIndex} (Đúng/Sai)` : `Tự Luận ${q.questionIndex}`}
                      </span>
                      <span className="font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                        ❌ {failRate}% Học Sinh Sai
                      </span>
                    </div>

                    <div className="text-xs text-slate-800 font-semibold line-clamp-3">
                      <MathRenderer content={q.questionText} />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      ✓ {q.correctAnswerText}
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandedQuestionId(expandedQuestionId === q.questionId ? null : q.questionId)}
                      className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer text-[11px]"
                    >
                      {expandedQuestionId === q.questionId ? 'Thu gọn ↑' : 'Xem chi tiết →'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. BỘ LỌC CÂU HỎI */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Lọc phần thi:</span>
          {[
            { id: 'all', label: `Tất Cả (${analyses.length})` },
            { id: 'I', label: `Phần I: Trắc Nghiệm (${summary.mcCount})` },
            { id: 'II', label: `Phần II: Đúng / Sai (${summary.tfCount})` },
            { id: 'III', label: `Phần III: Tự Luận (${summary.essayCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterPart(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterPart === tab.id
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500">Độ khó:</span>
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'hard', label: 'Sai nhiều / Khó' },
            { id: 'medium', label: 'Trung bình' },
            { id: 'easy', label: 'Dễ' },
          ].map((diff) => (
            <button
              key={diff.id}
              type="button"
              onClick={() => setFilterDifficulty(diff.id as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterDifficulty === diff.id
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {diff.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. DANH SÁCH CHI TIẾT TỪNG CÂU HỎI & PHÂN TÍCH LỰA CHỌN */}
      <div className="space-y-4">
        {filteredAnalyses.map((q) => {
          const isExpanded = expandedQuestionId === q.questionId;
          const failRate = 100 - q.correctRate;

          return (
            <div
              key={q.questionId}
              className={`bg-white rounded-2xl border-2 transition-all p-5 shadow-2xs ${
                q.correctRate < 50
                  ? 'border-rose-300 hover:border-rose-400'
                  : q.correctRate < 70
                  ? 'border-amber-200 hover:border-amber-400'
                  : 'border-slate-200 hover:border-indigo-300'
              }`}
            >
              {/* Question Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
                    {q.questionIndex}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-500">{q.partLabel}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border font-bold ${q.difficultyBadgeColor}`}>
                        {q.difficultyLabel}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Progress bar Đúng/Sai */}
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-700">Đúng: {q.correctRate}%</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs font-bold text-rose-700">Sai: {failRate}%</span>
                    </div>
                    <div className="w-28 sm:w-36 bg-slate-100 rounded-full h-2 overflow-hidden mt-1 border border-slate-200">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all"
                        style={{ width: `${q.correctRate}%` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedQuestionId(isExpanded ? null : q.questionId)}
                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
                    title={isExpanded ? 'Thu gọn' : 'Xem chi tiết'}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <div className="mt-3 text-sm text-slate-900 font-semibold leading-relaxed">
                <MathRenderer content={q.questionText} />
              </div>

              {/* Options & Choice Distribution (For Multiple Choice) */}
              {q.type === 'mc' && q.choiceDistribution && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Phân bố các lựa chọn A, B, C, D của học sinh ({q.totalAttempts} em đã làm):</span>
                    <span className="text-emerald-700 font-bold">{q.correctAnswerText}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {['A', 'B', 'C', 'D'].map((letter) => {
                      const stat = q.choiceDistribution![letter] || { count: 0, percent: 0 };
                      const isCorrectChoice = q.correctAnswerText.includes(letter);
                      return (
                        <div
                          key={letter}
                          className={`p-2.5 rounded-xl border flex items-center justify-between ${
                            isCorrectChoice
                              ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200'
                              : stat.percent > 25
                              ? 'bg-rose-50 border-rose-200'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-xs ${
                                isCorrectChoice
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-200 text-slate-800'
                              }`}
                            >
                              {letter}
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              {stat.count} em
                            </span>
                          </div>
                          <span
                            className={`font-mono text-xs font-black ${
                              isCorrectChoice
                                ? 'text-emerald-700'
                                : stat.percent > 25
                                ? 'text-rose-600 font-extrabold'
                                : 'text-slate-500'
                            }`}
                          >
                            {stat.percent}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sub-items for True / False */}
              {q.type === 'tf' && q.subItems && (
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                  <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Thống kê tỷ lệ đúng theo từng ý a, b, c, d:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.subItems.map((item) => (
                      <div
                        key={item.key}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                          item.correctRate >= 70 ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1 pr-2">
                          <span className="font-mono font-black text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                            Ý {item.key}
                          </span>
                          <span className="text-slate-700 text-[11px] line-clamp-1">{item.statement}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-bold text-[10px] text-slate-500">
                            {item.isCorrect ? 'ĐÚNG' : 'SAI'}
                          </span>
                          <span className={`font-mono font-black text-xs ${item.correctRate >= 70 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {item.correctRate}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expanded details (Options & Explanation) */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t-2 border-dashed border-slate-200 space-y-3 bg-slate-50/80 -mx-5 -mb-5 p-5 rounded-b-2xl">
                  {q.options && q.options.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-black text-slate-700 uppercase">Các phương án lựa chọn:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs text-slate-800"
                          >
                            <MathRenderer content={opt} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {q.explanation && (
                    <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-xl text-xs space-y-1">
                      <div className="font-black text-indigo-900 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Lời Giải & Hướng Dẫn Sư Phạm Của Giáo Viên:</span>
                      </div>
                      <div className="text-slate-800 leading-relaxed font-sans">
                        <MathRenderer content={q.explanation} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
