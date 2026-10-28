import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Check, X, GripVertical, CheckCircle2 } from 'lucide-react'

const Tooltip = ({ children, content }: { children: React.ReactElement<any>, content: string }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const childRef = useRef<HTMLElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (e: any) => {
    timeoutRef.current = setTimeout(() => {
      if (childRef.current) {
        const rect = childRef.current.getBoundingClientRect();
        setCoords({
          x: rect.left + rect.width / 2,
          y: rect.top - 8
        });
        setIsVisible(true);
      }
    }, 400);
    if (children.props.onMouseEnter) children.props.onMouseEnter(e);
  };

  const handleMouseLeave = (e: any) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
    if (children.props.onMouseLeave) children.props.onMouseLeave(e);
  };
  
  const handleDragStart = (e: any) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
    if (children.props.onDragStart) children.props.onDragStart(e);
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <>
      {React.cloneElement(children, {
        ref: childRef,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        onDragStart: handleDragStart
      })}
      {isVisible && createPortal(
        <div 
          className="fixed z-[9999] px-2.5 py-1.5 bg-[#090a0f] border border-red-900/60 text-zinc-200 text-[11px] font-mono rounded shadow-[0_4px_16px_rgba(0,0,0,0.9)] pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{ 
            left: coords.x, 
            top: coords.y,
            whiteSpace: 'normal',
            width: 'max-content',
            maxWidth: '220px',
            textAlign: 'center'
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
};

export interface TiersConfiguratorProps {
  onClose?: () => void;
  embedded?: boolean;
}

interface Effect {
  id: string;
  name: string;
  description: string;
}

interface Tier {
  id: string;
  name: string;
  price: string;
  effects: Effect[];
}

const INITIAL_POOL: Effect[] = [
  { id: 'hop', name: 'Ик!', description: 'Итан внезапно подпрыгивает, сбивая прицел.' },
  { id: 'push_back', name: 'Ветерок', description: 'Неведомая сила толкает героя назад.' },
  { id: 'spin_180', name: 'Головокружение', description: 'Камера резко разворачивается на 180 градусов.' },
  { id: 'auto_run', name: 'Леон — спринтер', description: 'Скорость передвижения увеличена на 60 секунд.' },
  { id: 'fov_narrow', name: 'Клаустрофобия', description: 'Поле зрения сужается, создавая давящее чувство.' },
  { id: 'fov_wide', name: 'Рыбий глаз', description: 'Поле зрения расширяется, искажая перспективу.' },
  { id: 'camera_shake', name: 'Паническая атака', description: 'Камера начинает сильно трястись.' },
  { id: 'ui_wipe', name: 'Где мои очки?', description: 'Интерфейс игры временно скрывается.' },
  { id: 'static_burst', name: 'Помехи экрана', description: 'На экране появляются сильные радиопомехи на пару секунд.' },
  { id: 'light_heal', name: 'Подорожник', description: 'Восстанавливает 15% от максимального здоровья.' },
  { id: 'papercut', name: 'Царапина', description: 'Отнимает 5% здоровья. Осторожно, щиплет!' },
  { id: 'speed_up', name: 'Адреналин', description: 'Игрок начинает двигаться заметно быстрее.' },
  { id: 'slow_down', name: 'Тяжелые ботинки', description: 'Движения становятся медленными и тяжелыми.' },
  { id: 'empty_mag', name: 'Осечка', description: 'Текущий магазин мгновенно пустеет.' },
  { id: 'care_package', name: 'С небес', description: 'Сбрасывает немного припасов прямо в инвентарь.' },
  { id: 'green_herb', name: 'Зеленушка', description: 'Добавляет зеленую траву в инвентарь.' },
  { id: 'invert_controls', name: 'Пьяный геймпад', description: 'Инвертирует управление на 10 секунд.' },
  { id: 'disarm', name: 'Пацифист', description: 'Временно запрещает использовать оружие.' },
  { id: 'blackout', name: 'Вырубили свет', description: 'Экран полностью гаснет на 3 секунды.' },
  { id: 'fake_mrx', name: 'Свой среди чужих', description: 'Проигрывает тяжелые шаги Мистера Х где-то рядом.' }
];

export const TiersConfigurator: React.FC<TiersConfiguratorProps> = ({ onClose, embedded = false }) => {
  const [pool, setPool] = useState<Effect[]>(INITIAL_POOL);
  const [currency, setCurrency] = useState('₽');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [tiers, setTiers] = useState<Tier[]>([
    { id: 't1', name: 'Tier 1', price: '100', effects: [] },
    { id: 't2', name: 'Tier 2', price: '500', effects: [] },
    { id: 't3', name: 'Tier 3', price: '1000', effects: [] },
  ]);

  const [draggedEffect, setDraggedEffect] = useState<{ effect: Effect, source: 'pool' | string } | null>(null);

  const handleDragStart = (e: React.DragEvent, effect: Effect, source: string) => {
    setDraggedEffect({ effect, source });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', effect.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropToPool = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedEffect || draggedEffect.source === 'pool') return;

    setTiers(prev => prev.map(t => 
      t.id === draggedEffect.source 
        ? { ...t, effects: t.effects.filter(ef => ef.id !== draggedEffect.effect.id) }
        : t
    ));
    
    setPool(prev => [...prev, draggedEffect.effect]);
    setDraggedEffect(null);
  };

  const handleDropToTier = (e: React.DragEvent, tierId: string) => {
    e.preventDefault();
    if (!draggedEffect || draggedEffect.source === tierId) return;

    if (draggedEffect.source === 'pool') {
      setPool(prev => prev.filter(ef => ef.id !== draggedEffect.effect.id));
    } else {
      setTiers(prev => prev.map(t => 
        t.id === draggedEffect.source 
          ? { ...t, effects: t.effects.filter(ef => ef.id !== draggedEffect.effect.id) }
          : t
      ));
    }

    setTiers(prev => prev.map(t => 
      t.id === tierId 
        ? { ...t, effects: [...t.effects, draggedEffect.effect] }
        : t
    ));
    setDraggedEffect(null);
  };

  const handlePriceChange = (tierId: string, newPrice: string) => {
    setTiers(prev => prev.map(t => 
      t.id === tierId ? { ...t, price: newPrice } : t
    ));
  };

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      if (!embedded && onClose) onClose();
    }, 1200);
  };

  const content = (
    <div className="w-full h-full flex flex-col gap-2 font-mono text-zinc-200 overflow-hidden">
      {/* HEADER BAR */}
      <div className="flex justify-between items-center border-b border-[#222634] pb-1.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-600" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100 font-mono">
            КОНФИГУРАТОР ТИРОВ И ПУЛА ЭФФЕКТОВ
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 uppercase">Валюта донатов:</span>
          <select 
            value={currency} 
            onChange={(e) => setCurrency(e.target.value)}
            className="bg-[#0a0c10] border border-[#2b3042] text-zinc-200 text-xs outline-none px-2 py-0.5 rounded cursor-pointer font-mono"
          >
            <option value="₽">₽ (RUB)</option>
            <option value="$">$ (USD)</option>
            <option value="€">€ (EUR)</option>
            <option value="₴">₴ (UAH)</option>
            <option value="₸">₸ (KZT)</option>
          </select>
        </div>
      </div>

      {/* WORKSPACE */}
      <div className="flex-1 min-h-0 flex gap-2.5 overflow-hidden">
        {/* POOL (35%) */}
        <div 
          className="w-[36%] flex flex-col bg-[#0e1017] border border-[#222634] rounded p-2 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] overflow-hidden"
          onDragOver={handleDragOver}
          onDrop={handleDropToPool}
        >
          <div className="flex items-center justify-between border-b border-[#222634] pb-1 mb-1.5 flex-shrink-0">
            <h3 className="text-[10px] uppercase font-bold text-zinc-400 font-mono">
              ОБЩИЙ ПУЛ ({pool.length})
            </h3>
            <span className="text-[9px] text-zinc-600 uppercase">В тир ➔</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-2 gap-1 content-start pr-1">
            {pool.map(effect => (
              <Tooltip key={effect.id} content={effect.description}>
                <div 
                  draggable
                  onDragStart={(e) => handleDragStart(e, effect, 'pool')}
                  className="bg-[#141722] hover:bg-[#1a1e2d] border border-[#262c3e] hover:border-red-900/60 py-1 px-1.5 rounded flex items-center gap-1 cursor-grab active:cursor-grabbing text-zinc-300 transition-colors select-none"
                >
                  <GripVertical size={12} className="text-zinc-500 flex-shrink-0" />
                  <span className="text-[10px] whitespace-nowrap overflow-hidden text-ellipsis">{effect.name}</span>
                </div>
              </Tooltip>
            ))}
            {pool.length === 0 && (
              <div className="col-span-2 text-xs text-zinc-600 text-center py-6">Все эффекты распределены</div>
            )}
          </div>
        </div>

        {/* TIERS (64%) */}
        <div className="w-[64%] flex gap-2 overflow-hidden">
          {tiers.map(tier => (
            <div 
              key={tier.id}
              className="flex-1 min-w-0 flex flex-col bg-[#0e1017] border border-[#222634] rounded p-2 shadow-[inset_0_0_10px_rgba(0,0,0,0.4)] overflow-hidden"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropToTier(e, tier.id)}
            >
              <div className="text-center mb-1.5 border-b border-[#222634] pb-1 flex-shrink-0">
                <h3 className="text-[11px] uppercase font-bold text-red-400 font-mono tracking-wider">{tier.name}</h3>
                <div className="flex justify-center items-center gap-1 text-[10px] text-zinc-400 mt-0.5">
                  <span>порог:</span>
                  <input
                    type="number"
                    value={tier.price}
                    onChange={(e) => handlePriceChange(tier.id, e.target.value)}
                    className="bg-[#08090d] border border-[#262c3e] focus:border-red-600/70 text-center w-12 text-zinc-100 rounded text-[11px] py-0.5 outline-none font-mono appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="font-bold text-red-400">{currency}</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-1 bg-[#090a0f] border border-[#1b1e2a] rounded p-1 min-h-0">
                {tier.effects.map(effect => (
                  <Tooltip key={effect.id} content={effect.description}>
                    <div 
                      draggable
                      onDragStart={(e) => handleDragStart(e, effect, tier.id)}
                      className="bg-[#131620] hover:bg-[#181c28] border border-[#252a3a] hover:border-red-900/60 py-1 px-1.5 rounded flex items-center gap-1 cursor-grab active:cursor-grabbing text-zinc-200 transition-colors select-none"
                    >
                      <GripVertical size={12} className="text-zinc-600 flex-shrink-0" />
                      <span className="text-[10px] whitespace-nowrap overflow-hidden text-ellipsis flex-1">{effect.name}</span>
                    </div>
                  </Tooltip>
                ))}
                {tier.effects.length === 0 && (
                  <div className="text-[9px] text-zinc-600 text-center py-4 uppercase font-mono">
                    Перетащите сюда
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER BAR */}
      <div className="flex justify-between items-center border-t border-[#222634] pt-1.5 flex-shrink-0">
        <span className="text-[10px] text-zinc-500 font-mono">
          {tiers.reduce((acc, t) => acc + t.effects.length, 0)} эффектов активно в {tiers.length} тирах
        </span>
        <div className="flex items-center gap-2">
          {!embedded && onClose && (
            <button 
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#12141c] hover:bg-[#181a24] border border-[#252938] text-zinc-300 rounded text-xs uppercase font-mono font-bold transition-all"
            >
              <X size={12} /> Назад
            </button>
          )}
          <button 
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3.5 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-200 border border-red-800/60 rounded text-xs uppercase font-mono font-bold transition-all shadow-[0_0_10px_rgba(220,38,38,0.15)]"
          >
            {savedSuccess ? (
              <>
                <CheckCircle2 size={12} className="text-emerald-400" />
                <span className="text-emerald-300">СОХРАНЕНО</span>
              </>
            ) : (
              <>
                <Check size={12} />
                <span>СОХРАНИТЬ КОНФИГУРАЦИЮ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-0 z-50 bg-[#0c0e14]/95 backdrop-blur-sm p-3.5 flex flex-col font-mono overflow-hidden"
    >
      {content}
    </motion.div>
  );
};



