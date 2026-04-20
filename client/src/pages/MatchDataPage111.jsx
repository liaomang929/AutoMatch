import { useState, useEffect } from 'react';
import { message } from 'antd';
import { SyncOutlined, DownloadOutlined, CheckCircleOutlined, StarOutlined } from '@ant-design/icons';
import { scrapeMatches, getMatches, saveSelected } from '../api';

export default function MatchDataPage() {
  const date = new Date().toISOString().split('T')[0];
  const [matches, setMatches] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await getMatches(date);
      setMatches(res.data?.raw || []);
      setSelected(res.data?.selected || []);
    } catch (e) {
      console.error('加载数据失败', e);
    }
  };
  
  const handleScrape = async () => {
    setLoading(true);
    // 先清空旧数据
    setMatches([]);
    setSelected([]);
    try {
      message.loading({ content: '正在抓取500彩票网数据，请稍候...', key: 'scrape', duration: 0 });
      const res = await scrapeMatches();
      message.success({ content: `成功抓取 ${res.count} 场比赛`, key: 'scrape' });
      const scrapedMatches = res.data || [];
      setMatches(scrapedMatches);
      // 刷新selected数据
      try {
        const matchRes = await getMatches(date);
        setSelected(matchRes.data?.selected || []);
      } catch (e) {
        // 忽略，selected数据可能还没保存
      }
    } catch (e) {
      message.error({ content: `抓取失败: ${e.message}`, key: 'scrape' });
      // 抓取失败时恢复原数据
      loadData();
    } finally {
      setLoading(false);
    }
  };

  const selectedIds = selected.map(m => m.matchId);

  // 自动推荐选场数量
  const getRecommendCount = () => {
    const total = matches.length;
    if (total <= 5) return total;
    if (total <= 10) return 4;
    return 6;
  };

  // 切换选中状态
  const toggleSelect = (record) => {
    const maxCount = getRecommendCount();
    const exists = selected.find(m => m.matchId === record.matchId);
    if (exists) {
      setSelected(selected.filter(m => m.matchId !== record.matchId));
    } else {
      if (selected.length >= maxCount) {
        message.warning(`最多选择 ${maxCount} 场重点比赛`);
        return;
      }
      setSelected([...selected, {
        ...record,
        prediction: '',
        confidence: 3,
        analysisNote: '',
        isHot: false,
      }]);
    }
  };

  // 智能推荐
  const handleAutoSelect = () => {
    const count = getRecommendCount();
    if (matches.length === 0) {
      message.warning('请先抓取比赛数据');
      return;
    }
    const leagueRank = {
      '英超': 1, '西甲': 2, '意甲': 3, '德甲': 4, '法甲': 5,
      '欧冠': 6, '欧联': 7, '亚冠': 8, '英冠': 9,
      '中超': 10, '日职': 11, '韩职': 12, '葡超': 13, '荷甲': 14,
    };
    const scored = matches.map(m => {
      let score = 0;
      score += (10 - (leagueRank[m.league] || 15)) * 2;
      if (m.oddsWin && m.oddsLoss) {
        score += Math.abs(parseFloat(m.oddsWin) - parseFloat(m.oddsLoss)) * 2;
      }
      return { ...m, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const recommended = scored.slice(0, count).map(m => ({
      ...m,
      prediction: '',
      confidence: 3,
      analysisNote: '',
      isHot: false,
    }));
    setSelected(recommended);
    message.success(`已推荐 ${count} 场重点比赛`);
  };

  // 保存选中
  const handleSave = async () => {
    if (selected.length === 0) {
      message.warning('请先选择重点比赛');
      return;
    }
    setSaving(true);
    try {
      await saveSelected(date, selected);
      message.success('重点比赛已保存');
      loadData();
    } catch (e) {
      message.error(`保存失败: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="space-y-6">
      {/* 统计与操作卡片 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gray-50 rounded-xl p-5">
            <div className="text-sm font-medium text-gray-500 mb-1">今日比赛总数</div>
            <div className="text-3xl font-semibold text-gray-900">{matches.length}<span className="text-lg text-gray-400 ml-1">场</span></div>
          </div>
          <div className="bg-blue-50 rounded-xl p-5">
            <div className="text-sm font-medium text-blue-600 mb-1">已选重点比赛</div>
            <div className="text-3xl font-semibold text-blue-700">{selected.length}<span className="text-lg text-blue-500 ml-1">场</span></div>
          </div>
          <div className="bg-amber-50 rounded-xl p-5">
            <div className="text-sm font-medium text-amber-600 mb-1">推荐选择</div>
            <div className="text-3xl font-semibold text-amber-700">{getRecommendCount()}<span className="text-lg text-amber-500 ml-1">场</span></div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleScrape}
            disabled={loading}
            className="primary-button flex items-center space-x-2"
          >
            <DownloadOutlined />
            <span>{loading ? '抓取中...' : '抓取今日比赛数据'}</span>
          </button>

          <button
            onClick={handleAutoSelect}
            className="secondary-button flex items-center space-x-2"
          >
            <StarOutlined />
            <span>智能推荐</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving || selected.length === 0}
            className="bg-emerald-600 text-white font-medium px-5 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircleOutlined />
            <span>{saving ? '保存中...' : '保存选择'}</span>
          </button>
        </div>

        {selected.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
            <div className="flex items-center text-blue-700">
              <span className="text-lg mr-2">💡</span>
              <p className="text-sm">
                已选 <span className="font-semibold">{selected.length}</span> 场（建议选 <span className="font-semibold">{getRecommendCount()}</span> 场），点击「保存选择」后可在「选场预测」中录入预测
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 比赛卡片网格 */}
      {matches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-4">⚽</div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">暂无比赛数据</h3>
          <p className="text-gray-500 mb-6">点击上方「抓取今日比赛数据」获取最新赛事信息</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map((match, index) => {
            const isSelected = selectedIds.includes(match.matchId);
            return (
              <div
                key={match.matchId}
                className={`bg-white rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-100 hover:border-gray-300'
                }`}
              >
                <div className="p-5">
                  {/* 头部：编号、赛事、让步、时间 */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center flex-wrap gap-1.5">
                      <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1 rounded">
                        #{match.matchId}
                      </span>
                      <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-1 rounded">
                        {match.league || '未知赛事'}
                      </span>
                      {match.handicapLine && (
                        <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded">
                          让步: {match.handicapLine}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 font-medium">
                        {match.matchTime || '时间待定'}
                      </span>
                    </div>
                  </div>

                  {/* 核心信息：对阵双方 */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-lg font-semibold text-gray-900">{match.homeTeam || '主队'}</div>
                      <div className="text-xs text-gray-400 px-2">VS</div>
                      <div className="text-lg font-semibold text-gray-900">{match.awayTeam || '客队'}</div>
                    </div>
                  </div>

                  {/* 数据层：赔率 */}
                  <div className="mb-6">
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-red-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500 mb-1">胜</div>
                        <div className="text-lg font-semibold tabular-nums text-red-600">
                          {match.oddsWin || '-'}
                        </div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500 mb-1">平</div>
                        <div className="text-lg font-semibold tabular-nums text-purple-600">
                          {match.oddsDraw || '-'}
                        </div>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500 mb-1">负</div>
                        <div className="text-lg font-semibold tabular-nums text-blue-600">
                          {match.oddsLoss || '-'}
                        </div>
                      </div>
                    </div>

                    {/* 让球赔率（如果有） */}
                    {(match.handicapWin || match.handicapDraw || match.handicapLoss) && (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-red-50/50 rounded-lg p-2 text-center">
                          <div className="text-xs text-gray-500 mb-1">让胜</div>
                          <div className="text-sm font-medium tabular-nums text-red-500">
                            {match.handicapWin || '-'}
                          </div>
                        </div>
                        <div className="bg-purple-50/50 rounded-lg p-2 text-center">
                          <div className="text-xs text-gray-500 mb-1">让平</div>
                          <div className="text-sm font-medium tabular-nums text-purple-500">
                            {match.handicapDraw || '-'}
                          </div>
                        </div>
                        <div className="bg-blue-50/50 rounded-lg p-2 text-center">
                          <div className="text-xs text-gray-500 mb-1">让负</div>
                          <div className="text-sm font-medium tabular-nums text-blue-500">
                            {match.handicapLoss || '-'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 操作层 */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div>
                      {isSelected ? (
                        <span className="inline-flex items-center text-sm font-medium text-blue-700 bg-blue-100 px-3 py-1.5 rounded-full">
                          <CheckCircleOutlined className="mr-1.5" />
                          已选为重点
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500">未选择</span>
                      )}
                    </div>
                    <button
                      onClick={() => toggleSelect(match)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                        isSelected
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {isSelected ? '取消选择' : '选择为重点'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
