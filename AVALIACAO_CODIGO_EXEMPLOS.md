# Exemplos de Código - Módulo de Avaliação

## 📚 Snippets Reutilizáveis

### 1. Card com Animação de Entrada

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.05 }}
  className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all p-6"
>
  {/* Conteúdo do card */}
</motion.div>
```

---

### 2. Star Rating Component (Read-only)

```tsx
const StarRating = ({ score, max = 5 }: { score: number; max?: number }) => (
  <div className="flex gap-1">
    {Array.from({ length: max }).map((_, index) => (
      <FiStar
        key={index}
        className={`w-5 h-5 ${
          index < score 
            ? 'fill-yellow-400 text-yellow-400' 
            : 'text-gray-300'
        }`}
      />
    ))}
  </div>
);

// Uso
<StarRating score={4} />
```

---

### 3. Star Rating Component (Interactive)

```tsx
const InteractiveStarRating = ({ 
  value, 
  onChange, 
  labels 
}: { 
  value: number; 
  onChange: (val: number) => void;
  labels?: string[];
}) => {
  const [hoverValue, setHoverValue] = useState(0);
  
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <motion.button
          key={star}
          type="button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHoverValue(star)}
          onMouseLeave={() => setHoverValue(0)}
          className="relative group"
        >
          <FiStar
            className={`w-10 h-10 transition-all ${
              star <= (hoverValue || value)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
          {labels && labels[star - 1] && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3">
                {labels[star - 1]}
              </div>
            </div>
          )}
        </motion.button>
      ))}
    </div>
  );
};

// Uso
<InteractiveStarRating
  value={currentScore}
  onChange={(val) => setScore(val)}
  labels={[
    'Frequentemente não alcançou',
    'Não alcançou',
    'Alcançou',
    'Excedeu',
    'Superou consistentemente'
  ]}
/>
```

---

### 4. Status Badge Component

```tsx
type Status = 'pending' | 'approved' | 'rejected' | 'under_review';

const statusConfig: Record<Status, { color: string; bg: string; label: string; emoji: string }> = {
  pending: { 
    color: 'text-yellow-700', 
    bg: 'bg-yellow-100', 
    label: 'Pendente', 
    emoji: '🕐' 
  },
  approved: { 
    color: 'text-green-700', 
    bg: 'bg-green-100', 
    label: 'Aprovado', 
    emoji: '✅' 
  },
  rejected: { 
    color: 'text-red-700', 
    bg: 'bg-red-100', 
    label: 'Rejeitado', 
    emoji: '❌' 
  },
  under_review: { 
    color: 'text-purple-700', 
    bg: 'bg-purple-100', 
    label: 'Em Revisão', 
    emoji: '👀' 
  },
};

const StatusBadge = ({ status }: { status: Status }) => {
  const config = statusConfig[status];
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.color} ${config.bg} border border-current border-opacity-20`}>
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </span>
  );
};

// Uso
<StatusBadge status="approved" />
```

---

### 5. Progress Bar with Animation

```tsx
const AnimatedProgressBar = ({ 
  percentage, 
  color = 'blue',
  size = 'md',
  showLabel = true 
}: {
  percentage: number;
  color?: 'blue' | 'green' | 'purple' | 'orange';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}) => {
  const heights = { sm: 'h-1', md: 'h-2', lg: 'h-3' };
  const colors = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    purple: 'bg-purple-600',
    orange: 'bg-orange-600'
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        {showLabel && (
          <span className="text-sm font-medium text-gray-700">
            {percentage}%
          </span>
        )}
      </div>
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${heights[size]}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`${heights[size]} ${colors[color]} rounded-full`}
        />
      </div>
    </div>
  );
};

// Uso
<AnimatedProgressBar percentage={75} color="blue" size="md" />
```

---

### 6. Accordion Section with Animation

```tsx
const AccordionSection = ({ 
  title, 
  icon, 
  children,
  defaultExpanded = false 
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              {icon}
            </div>
          )}
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <FiChevronDown className="w-6 h-6 text-gray-600" />
        </motion.div>
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-6 border-t-2 border-gray-200">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Uso
<AccordionSection 
  title="Autoavaliação" 
  icon={<FiUser className="w-6 h-6 text-blue-600" />}
  defaultExpanded={true}
>
  <p>Conteúdo da seção...</p>
</AccordionSection>
```

---

### 7. Empty State Component

```tsx
const EmptyState = ({ 
  icon: Icon = FiInbox,
  title,
  description,
  actionLabel,
  onAction 
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="text-center py-16"
  >
    <div className="max-w-md mx-auto">
      <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <Icon className="w-12 h-12 text-gray-400" />
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-6">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="abz-button-primary"
        >
          {actionLabel}
        </button>
      )}
    </div>
  </motion.div>
);

// Uso
<EmptyState
  icon={FiCheckCircle}
  title="Nenhuma avaliação encontrada"
  description="Não há avaliações correspondentes aos filtros selecionados"
  actionLabel="Limpar Filtros"
  onAction={() => resetFilters()}
/>
```

---

### 8. Statistic Card

```tsx
const StatCard = ({ 
  icon: Icon,
  label,
  value,
  color = 'blue',
  trend,
  trendValue 
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  trend?: 'up' | 'down';
  trendValue?: string;
}) => {
  const colorConfig = {
    blue: { text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    green: { text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
    purple: { text: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
    orange: { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    red: { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' }
  };

  const config = colorConfig[color];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className={`bg-white rounded-xl p-6 border-2 ${config.border} shadow-sm hover:shadow-md transition-all`}
    >
      <div className="flex items-center gap-4">
        <div className={`${config.bg} ${config.text} p-3 rounded-lg`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className={`text-3xl font-bold ${config.text}`}>{value}</p>
          {trend && trendValue && (
            <p className={`text-sm ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {trend === 'up' ? '↑' : '↓'} {trendValue}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Uso
<StatCard
  icon={FiClock}
  label="Pendentes"
  value={12}
  color="orange"
  trend="down"
  trendValue="-3 desde ontem"
/>
```

---

### 9. Tooltip Component

```tsx
const Tooltip = ({ 
  children, 
  content,
  position = 'top' 
}: {
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}) => {
  const positions = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
  };

  return (
    <div className="relative group inline-block">
      {children}
      <div className={`absolute ${positions[position]} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50`}>
        <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap">
          {content}
        </div>
      </div>
    </div>
  );
};

// Uso
<Tooltip content="Clique para editar" position="top">
  <button>✏️</button>
</Tooltip>
```

---

### 10. Tabs Component

```tsx
const Tabs = ({ 
  tabs, 
  activeTab, 
  onChange 
}: {
  tabs: Array<{ id: string; label: string; icon?: React.ReactNode }>;
  activeTab: string;
  onChange: (id: string) => void;
}) => (
  <div className="bg-white rounded-xl shadow-md p-2 inline-flex gap-2">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
          activeTab === tab.id
            ? 'bg-blue-600 text-white shadow-md'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        {tab.icon}
        {tab.label}
      </button>
    ))}
  </div>
);

// Uso
<Tabs
  tabs={[
    { id: 'questionnaire', label: 'Questionário', icon: <FiFileText /> },
    { id: 'charts', label: 'Gráficos', icon: <FiBarChart /> }
  ]}
  activeTab={activeTab}
  onChange={setActiveTab}
/>
```

---

### 11. Filter Section

```tsx
const FilterSection = ({ 
  searchTerm, 
  onSearchChange,
  periodFilter,
  onPeriodChange,
  periods 
}: {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  periodFilter: string;
  onPeriodChange: (val: string) => void;
  periods: Array<{ id: string; nome: string }>;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-xl p-6 shadow-md"
  >
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
      </div>
      
      <select
        value={periodFilter}
        onChange={(e) => onPeriodChange(e.target.value)}
        className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
      >
        <option value="">Todos os Períodos</option>
        {periods.map((p) => (
          <option key={p.id} value={p.id}>{p.nome}</option>
        ))}
      </select>
    </div>
  </motion.div>
);

// Uso
<FilterSection
  searchTerm={searchTerm}
  onSearchChange={setSearchTerm}
  periodFilter={periodFilter}
  onPeriodChange={setPeriodFilter}
  periods={periodsData}
/>
```

---

### 12. Modal Component

```tsx
const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children,
  size = 'md' 
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) => {
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl'
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className={`bg-white rounded-2xl shadow-2xl ${sizes[size]} w-full max-h-[90vh] overflow-hidden`}
        >
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
            {children}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Uso
<Modal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  title="Detalhes da Avaliação"
  size="lg"
>
  <p>Conteúdo do modal...</p>
</Modal>
```

---

### 13. Loading Skeleton

```tsx
const Skeleton = ({ 
  className = '',
  variant = 'rectangular' 
}: {
  className?: string;
  variant?: 'circular' | 'rectangular' | 'text';
}) => {
  const variants = {
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
    text: 'rounded h-4'
  };

  return (
    <div 
      className={`animate-pulse bg-gray-200 ${variants[variant]} ${className}`}
    />
  );
};

const CardSkeleton = () => (
  <div className="bg-white rounded-xl p-6 shadow-md">
    <div className="flex items-center gap-4 mb-4">
      <Skeleton variant="circular" className="w-12 h-12" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="w-3/4" />
        <Skeleton variant="text" className="w-1/2" />
      </div>
    </div>
    <Skeleton variant="rectangular" className="h-24 mb-4" />
    <Skeleton variant="text" className="w-full" />
  </div>
);

// Uso
{isLoading ? (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <CardSkeleton />
    <CardSkeleton />
    <CardSkeleton />
  </div>
) : (
  <div>... conteúdo real ...</div>
)}
```

---

### 14. Notification Toast

```tsx
const Toast = ({ 
  message, 
  type = 'info',
  isVisible,
  onClose 
}: {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  isVisible: boolean;
  onClose: () => void;
}) => {
  const config = {
    success: { bg: 'bg-green-500', icon: FiCheckCircle },
    error: { bg: 'bg-red-500', icon: FiXCircle },
    warning: { bg: 'bg-yellow-500', icon: FiAlertCircle },
    info: { bg: 'bg-blue-500', icon: FiInfo }
  };

  const { bg, icon: Icon } = config[type];

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-4 right-4 z-50"
        >
          <div className={`${bg} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 max-w-md`}>
            <Icon className="w-6 h-6 flex-shrink-0" />
            <p className="flex-1">{message}</p>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Uso
const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

<Toast
  message={toast.message}
  type={toast.type}
  isVisible={toast.show}
  onClose={() => setToast({ ...toast, show: false })}
/>

// Trigger
setToast({ show: true, message: 'Avaliação salva!', type: 'success' });
```

---

### 15. Search with Debounce Hook

```tsx
const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Uso em componente
const SearchComponent = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  useEffect(() => {
    if (debouncedSearchTerm) {
      // Fazer a busca com o termo debounced
      performSearch(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm]);

  return (
    <input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Buscar..."
    />
  );
};
```

---

## 🎨 Utility Functions

### 1. Format Date

```tsx
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatDate = (date: string | Date, pattern = 'dd/MM/yyyy') => {
  return format(new Date(date), pattern, { locale: ptBR });
};

// Uso
<p>{formatDate(evaluation.created_at, 'dd/MM/yyyy HH:mm')}</p>
```

---

### 2. Calculate Score Color

```tsx
const getScoreColor = (score: number): string => {
  if (score >= 4) return 'text-green-600';
  if (score >= 3) return 'text-blue-600';
  if (score >= 2) return 'text-yellow-600';
  return 'text-red-600';
};

const getScoreLabel = (score: number): string => {
  if (score >= 4) return 'Superou consistentemente';
  if (score >= 3) return 'Alcançou expectativa';
  if (score >= 2) return 'Não alcançou';
  return 'Abaixo da expectativa';
};

// Uso
<span className={getScoreColor(evaluation.score)}>
  {evaluation.score} - {getScoreLabel(evaluation.score)}
</span>
```

---

### 3. Categorize Evaluations

```tsx
const categorizeEvaluations = (evaluations: Evaluation[]) => {
  return {
    pending: evaluations.filter(e => e.status === 'pending_response'),
    awaiting: evaluations.filter(e => e.status === 'awaiting_manager'),
    completed: evaluations.filter(e => ['approved', 'archived'].includes(e.status)),
    needsAction: evaluations.filter(e => e.status === 'returned_for_adjustment')
  };
};

// Uso
const { pending, awaiting, completed, needsAction } = categorizeEvaluations(allEvaluations);
```

---

### 4. Calculate Average Score

```tsx
const calculateAverage = (respostas: Record<string, { nota: number }>) => {
  const scores = Object.values(respostas)
    .filter(r => r?.nota)
    .map(r => r.nota);
  
  if (scores.length === 0) return 0;
  
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return (sum / scores.length).toFixed(1);
};

// Uso
<p>Média: {calculateAverage(evaluation.respostas)}</p>
```

---

### 5. Generate Chart Data

```tsx
const prepareRadarData = (
  respostas: Record<string, any>,
  questions: Array<{ id: string; pergunta: string }>
) => {
  return questions
    .filter(q => respostas[q.id]?.nota)
    .map(q => ({
      subject: q.id,
      fullName: q.pergunta,
      value: respostas[q.id].nota,
      fullMark: 5
    }));
};

const prepareScoreDistribution = (respostas: Record<string, any>) => {
  const distribution = Array(5).fill(0).map((_, i) => ({
    range: `${i + 1} Estrela${i > 0 ? 's' : ''}`,
    count: 0,
    color: ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#22c55e'][i]
  }));

  Object.values(respostas).forEach((r: any) => {
    if (r?.nota) {
      distribution[r.nota - 1].count++;
    }
  });

  return distribution;
};

// Uso
const radarData = prepareRadarData(respostas, QUESTIONARIO_PADRAO);
const barData = prepareScoreDistribution(respostas);
```

---

**Fim dos Exemplos de Código**
