import { useState, useEffect } from 'react';
import { message, Spin, Tag, Input } from 'antd';
import { RobotOutlined, ThunderboltOutlined, SaveOutlined, CopyOutlined, SettingOutlined } from '@ant-design/icons';
import { getMatches, getAnalyses, batchGenerateAnalysis, updateAnalysis, getAIStatus } from '../api';


export default function AIAnalysisPage() {
  const date = new Date().toISOString().split('T')[0];
  const [selected, setSelected] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [aiConfigured, setAiConfigured] = useState(false);
  const [batchResults, setBatchResults] = useState(null);

  useEffect(() => {
    loadData();
    checkAIStatus();
  }, []);

  const checkAIStatus = async () => {
    try {
      const res = await getAIStatus();
      setAiConfigured(res.data?.configured || false);
    } catch (e) {
      setAiConfigured(false);
    }
  };

  const loadData = async () => {
    try {
      const matchRes = await getMatches(date);
      const rawMatches = matchRes.data?.raw || [];
      let savedSelected = matchRes.data?.selected || [];
      
      // 用 raw matches 补全 selected 中缺失的字段
      if (savedSelected.length > 0) {
        savedSelected = savedSelected.map(sel => {
          if (sel.league && sel.homeTeam) return sel;
          const rawMatch = rawMatches.find(m => m.matchId === sel.matchId);
          if (rawMatch) {
            return { 
              ...sel, 
              league: rawMatch.league || sel.league || '未知赛事',
              homeTeam: rawMatch.homeTeam || sel.homeTeam || '',
              awayTeam: rawMatch.awayTeam || sel.awayTeam || '',
              oddsWin: rawMatch.oddsWin || sel.oddsWin || '',
              oddsDraw: rawMatch.oddsDraw || sel.oddsDraw || '',
              oddsLoss: rawMatch.oddsLoss || sel.oddsLoss || '',
              handicapLine: rawMatch.handicapLine || sel.handicapLine || '',
            };
          }
          return { ...sel, league: sel.league || '未知赛事' };
        });
      }
      setSelected(savedSelected);
      
      const analysisRes = await getAnalyses(date);
      setAnalyses(analysisRes.data || []);
    } catch (e) {
      console.error('加载数据失败', e);
    }
  };

  const handleBatchGenerate = async () => {
    if (!aiConfigured) {
      message.error('请先在"模型配置"中配置AI模型和API Key');
      return;
    }
    if (selected.length === 0) {
      message.warning('请先在"选场预测"中选择重点比赛');
      return;
    }
    setLoading(true);
    setBatchResults(null);
    try {
      message.loading({ content: '正在批量生成球之见逻辑分析，请稍候...', key: 'ai', duration: 0 });
      const res = await batchGenerateAnalysis(date);
      const results = res.data || [];
      const successCount = results.filter(r => !r.error).length;
      const failCount = results.filter(r => r.error).length;
      setBatchResults(results);
      if (failCount > 0) {
        message.warning({ content: `完成: ${successCount}场成功, ${failCount}场失败`, key: 'ai' });
      } else {
        message.success({ content: `成功生成 ${successCount} 场分析`, key: 'ai' });
      }
      loadData();
    } catch (e) {
      message.error({ content: `生成失败: ${e.message}`, key: 'ai' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async (matchId) => {
    try {
      await updateAnalysis(date, matchId, editContent);
      message.success('分析已更新');
      setEditingId(null);
      loadData();
    } catch (e) {
      message.error(`保存失败: ${e.message}`);
    }
  };

  const startEdit = (analysis) => {
    setEditingId(analysis.matchId);
    setEditContent(analysis.content);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const getMatchInfo = (matchId) => {
    return selected.find(m => m.matchId === matchId) || {};
  };

  const getAnalysis = (matchId) => {
    return analyses.find(a => a.matchId === matchId) || null;
  };

  const confidenceMap = { 1: '⭐', 2: '⭐⭐', 3: '⭐⭐⭐', 4: '⭐⭐⭐⭐', 5: '⭐⭐⭐⭐⭐' };

  return (
    <div className="space-y-6">
      {/* AI配置状态提示 */}
      {!aiConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start space-x-4">
            <div className="p-2 bg-amber-100 rounded-lg">
              <SettingOutlined className="text-amber-600 text-lg" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-amber-800 mb-1">AI模型未配置</h3>
              <p className="text-amber-700">
                请先在左侧菜单「模型配置」中配置AI模型和API Key，才能使用AI分析功能。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 批量生成失败提示 */}
      {batchResults && batchResults.some(r => r.error) && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="text-red-600 text-lg">⚠️</div>
              <div>
                <h3 className="font-semibold text-red-800 mb-2">部分比赛AI分析失败</h3>
                <ul className="space-y-2">
                  {batchResults.filter(r => r.error).map(r => {
                    const match = getMatchInfo(r.matchId);
                    return (
                      <li key={r.matchId} className="text-red-700">
                        {match.homeTeam || r.matchId} VS {match.awayTeam || ''} — {r.error}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <button
              onClick={() => setBatchResults(null)}
              className="text-red-600 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 操作卡片 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <RobotOutlined className="text-blue-600 text-2xl" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">球之见逻辑分析</h2>
                <p className="text-gray-600 mt-1">基于比赛数据和预测，生成专业分析报告</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="bg-gray-50 rounded-xl p-4 min-w-[180px]">
              <div className="text-sm font-medium text-gray-500 mb-1">分析进度</div>
              <div className="flex items-center space-x-4">
                <div className="text-2xl font-semibold text-gray-900">{analyses.length}<span className="text-lg text-gray-400 ml-1">场</span></div>
                <div className="text-sm text-gray-500">/ {selected.length} 场</div>
              </div>
            </div>

            <button
              onClick={handleBatchGenerate}
              disabled={loading || !aiConfigured || selected.length === 0}
              className="primary-button flex items-center space-x-2 px-6 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ThunderboltOutlined />
              <span>{loading ? '分析中...' : '一键生成所有分析'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Spin size="large" tip="AI正在分析中..." className="mb-4" />
          <p className="text-gray-500">正在为 {selected.length} 场比赛生成逻辑分析，请稍候...</p>
        </div>
      )}

      {/* 分析卡片网格 */}
      <div className="space-y-6">
        {selected.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-5xl mb-4">🤖</div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">暂无待分析比赛</h3>
            <p className="text-gray-500 mb-6">请先在「选场预测」页面选择重点比赛并保存</p>
          </div>
        ) : (
          selected.map((match) => {
            const analysis = getAnalysis(match.matchId);
            const hasAnalysis = !!analysis;
            const isEditing = editingId === match.matchId;
            const confidenceStars = match.confidence ? '★'.repeat(match.confidence) + '☆'.repeat(5 - match.confidence) : '';

            return (
              <div
                key={match.matchId}
                className={`bg-white rounded-2xl border-2 transition-all duration-200 ${
                  hasAnalysis ? 'border-emerald-200' : 'border-gray-100'
                }`}
              >
                <div className="p-6">
                  {/* 卡片头部：比赛信息 */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between mb-6">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span className="bg-amber-100 text-amber-800 text-sm font-medium px-3 py-1.5 rounded-full">
                          {match.league || '未知赛事'}
                        </span>
                        <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1.5 rounded-full">
                          #{match.matchId}
                        </span>
                        {match.isHot && (
                          <span className="bg-red-100 text-red-800 text-sm font-medium px-3 py-1.5 rounded-full flex items-center">
                            <span className="mr-1">🔥</span>
                            热门比赛
                          </span>
                        )}
                        {match.prediction && (
                          <span className="bg-purple-100 text-purple-800 text-sm font-medium px-3 py-1.5 rounded-full">
                            预测: {Array.isArray(match.prediction) ? match.prediction.join(',') : match.prediction}
                          </span>
                        )}
                        {confidenceStars && (
                          <span className="text-amber-500 text-sm font-medium">{confidenceStars}</span>
                        )}
                      </div>

                      <h3 className="text-xl font-bold text-gray-900">
                        {match.homeTeam} <span className="text-gray-400 mx-2">VS</span> {match.awayTeam}
                      </h3>
                      <p className="text-gray-500 mt-1">{match.matchTime || '时间待定'}</p>
                    </div>

                    {/* 操作按钮 */}
                    <div className="mt-4 md:mt-0 flex space-x-2">
                      {hasAnalysis && !isEditing && (
                        <>
                          <button
                            onClick={() => copyToClipboard(analysis.content)}
                            className="secondary-button flex items-center space-x-2 text-sm px-3 py-2"
                          >
                            <CopyOutlined />
                            <span>复制</span>
                          </button>
                          <button
                            onClick={() => startEdit(analysis)}
                            className="primary-button flex items-center space-x-2 text-sm px-3 py-2"
                          >
                            <SaveOutlined />
                            <span>编辑</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 用户分析笔记 */}
                  {match.analysisNote && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                      <div className="text-sm font-medium text-blue-700 mb-1">我的分析笔记</div>
                      <p className="text-blue-800">{match.analysisNote}</p>
                    </div>
                  )}

                  {/* AI分析内容区域 */}
                  <div className="mt-6">
                    {hasAnalysis ? (
                      isEditing ? (
                        <div className="space-y-4">
                          <Input.TextArea
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            rows={8}
                            className="rounded-xl text-gray-700"
                            placeholder="编辑分析内容..."
                          />
                          <div className="flex justify-end space-x-3">
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-4 py-2 text-gray-700 font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                              取消
                            </button>
                            <button
                              onClick={() => handleSaveEdit(match.matchId)}
                              className="px-4 py-2 text-white font-medium bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center space-x-2"
                            >
                              <SaveOutlined />
                              <span>保存修改</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {/* 结论层：AI分析内容（有明显视觉重心） */}
                          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6">
                            <div className="flex items-center mb-4">
                              <div className="p-2 bg-emerald-100 rounded-lg mr-3">
                                <RobotOutlined className="text-emerald-600" />
                              </div>
                              <h4 className="text-lg font-semibold text-emerald-800">球之见逻辑分析</h4>
                            </div>
                            <div className="text-gray-800 leading-relaxed whitespace-pre-wrap font-sans text-[15px]">
                              {analysis.content}
                            </div>
                          </div>

                          {/* 违禁词提示 */}
                          {analysis.bannedWordsFound?.length > 0 && (
                            <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                              <div className="text-sm font-medium text-amber-700 mb-1">已过滤违禁词</div>
                              <div className="text-amber-600 text-sm">
                                {analysis.bannedWordsFound.join(', ')}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="text-center p-8 bg-gray-50 border border-gray-200 rounded-2xl">
                        <div className="text-4xl mb-4">🤔</div>
                        <h4 className="text-lg font-medium text-gray-700 mb-2">暂无分析</h4>
                        <p className="text-gray-500 mb-4">点击上方「一键生成所有分析」按钮生成智能分析报告</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
