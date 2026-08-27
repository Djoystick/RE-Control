import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Check, X, GripVertical } from 'lucide-react'

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
          className="fixed z-[9999] px-2 py-1.5 bg-pixel-void border border-pixel-cyan/80 text-pixel-light text-[11px] font-mono rounded shadow-[0_0_12px_rgba(34,211,238,0.2)] pointer-events-none transform -translate-x-1/2 -translate-y-full"
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
  onClose: () => void;
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
  { id: 'mirror_screen', name: 'Зеркало', description: 'Экран зеркально отражается по горизонтали.' },
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
  { id: 'mute_sound', name: 'Немой режим', description: 'Отключает все звуки игры.' },
  { id: 'fake_mrx', name: 'Свой среди чужих', description: 'Проигрывает тяжелые шаги Мистера Х где-то рядом.' }
];

export const TiersConfigurator: React.FC<TiersConfiguratorProps> = ({ onClose }) => {
  const [pool, setPool] = useState<Effect[]>(INITIAL_POOL);
  const [tiers, setTiers] = useState<Tier[]>([
    { id: 't1', name: 'Tier 1', price: '100₽', effects: [] },
    { id: 't2', name: 'Tier 2', price: '500₽', effects: [] },
    { id: 't3', name: 'Tier 3', price: '1000₽', effects: [] },
  ]);

  const [draggedEffect, setDraggedEffect] = useState<{ effect: Effect, source: 'pool' | string } | null>(null);

  const handleDragStart = (e: React.DragEvent, effect: Effect, source: string) => {
    setDraggedEffect({ effect, source });
    // Required for Firefox
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

    // Remove from tier
    setTiers(prev => prev.map(t => 
      t.id === draggedEffect.source 
        ? { ...t, effects: t.effects.filter(ef => ef.id !== draggedEffect.effect.id) }
        : t
    ));
    
    // Add to pool
    setPool(prev => [...prev, draggedEffect.effect]);
    setDraggedEffect(null);
  };

  const handleDropToTier = (e: React.DragEvent, tierId: string) => {
    e.preventDefault();
    if (!draggedEffect || draggedEffect.source === tierId) return;

    // Remove from previous location
    if (draggedEffect.source === 'pool') {
      setPool(prev => prev.filter(ef => ef.id !== draggedEffect.effect.id));
    } else {
      setTiers(prev => prev.map(t => 
        t.id === draggedEffect.source 
          ? { ...t, effects: t.effects.filter(ef => ef.id !== draggedEffect.effect.id) }
          : t
      ));
    }

    // Add to new tier
    setTiers(prev => prev.map(t => 
      t.id === tierId 
        ? { ...t, effects: [...t.effects, draggedEffect.effect] }
        : t
    ));
    setDraggedEffect(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-0 z-50 bg-pixel-panel/95 backdrop-blur-sm p-4 flex flex-col gap-2 text-pixel-cyan font-mono overflow-hidden"
    >
      <h2 className="text-xl font-bold uppercase tracking-widest border-b border-pixel-muted pb-2">
        Donation Tiers Configuration
      </h2>

      <div className="flex-1 min-h-0 flex gap-6 overflow-hidden">
        {/* POOL */}
        <div 
          className="w-1/3 flex flex-col bg-pixel-void border border-pixel-muted rounded p-3 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"
          onDragOver={handleDragOver}
          onDrop={handleDropToPool}
        >
          <h3 className="text-sm uppercase font-bold text-pixel-light/70 mb-3 text-center border-b border-pixel-muted/50 pb-1">
            Общий пул эффектов
          </h3>
          <div className="flex-1 overflow-hidden grid grid-cols-2 gap-1.5 content-start">
            {pool.map(effect => (
              <Tooltip key={effect.id} content={effect.description}>
                <div 
                  draggable
                  onDragStart={(e) => handleDragStart(e, effect, 'pool')}
                  className="bg-pixel-panel border border-pixel-cyan/30 py-1 px-2 rounded flex items-center gap-1.5 cursor-grab active:cursor-grabbing hover:bg-pixel-cyan/10 transition-colors"
                >
                  <GripVertical size={14} className="text-pixel-muted" />
                  <span className="text-[10px] whitespace-nowrap overflow-hidden text-ellipsis">{effect.name}</span>
                </div>
              </Tooltip>
            ))}
            {pool.length === 0 && (
              <div className="text-xs text-pixel-muted text-center mt-4">Пул пуст</div>
            )}
          </div>
        </div>

        {/* TIERS */}
        <div className="w-2/3 flex gap-2 overflow-hidden">
          {tiers.map(tier => (
            <div 
              key={tier.id}
              className="flex-1 min-w-0 flex flex-col bg-pixel-void border border-pixel-amber/30 rounded p-2 shadow-[inset_0_0_10px_rgba(245,158,11,0.1)]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropToTier(e, tier.id)}
            >
              <div className="text-center mb-3 border-b border-pixel-amber/30 pb-1">
                <h3 className="text-sm uppercase font-bold text-pixel-amber">{tier.name}</h3>
                <span className="text-xs text-pixel-light/70">{tier.price}</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 pr-1 bg-pixel-panel/20 rounded p-1">
                {tier.effects.map(effect => (
                  <Tooltip key={effect.id} content={effect.description}>
                    <div 
                      draggable
                      onDragStart={(e) => handleDragStart(e, effect, tier.id)}
                      className="bg-pixel-panel border border-pixel-amber/50 py-1 px-2 rounded flex items-center gap-1.5 cursor-grab active:cursor-grabbing hover:bg-pixel-amber/10 transition-colors shadow-[0_0_5px_rgba(245,158,11,0.2)]"
                    >
                      <GripVertical size={14} className="text-pixel-amber/50" />
                      <span className="text-[10px] text-pixel-light whitespace-nowrap overflow-hidden text-ellipsis">{effect.name}</span>
                    </div>
                  </Tooltip>
                ))}
                {tier.effects.length === 0 && (
                  <div className="text-[10px] text-pixel-muted text-center mt-4 uppercase">Drag effects here</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex justify-end gap-3 mt-2">
        <button 
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 bg-pixel-void border border-pixel-muted text-pixel-light/70 hover:bg-pixel-muted/20 hover:text-pixel-light rounded text-xs uppercase font-bold transition-colors"
        >
          <X size={14} /> Back
        </button>
        <button 
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/50 text-green-400 hover:bg-green-500/20 rounded text-xs uppercase font-bold transition-colors shadow-[0_0_10px_rgba(34,197,94,0.2)]"
        >
          <Check size={14} /> Save & Close
        </button>
      </div>
    </motion.div>
  );
};



