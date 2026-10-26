import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'es' | 'ca';

export interface Translations {
  months: string[];
  monthsShort: string[];
  tables: {
    incomeTitle: string;
    incomeAdd: string;
    fixedTitle: string;
    fixedAdd: string;
    leisureTitle: string;
    leisureAdd: string;
    savingsTitle: string;
    savingsAdd: string;
    totalEarned: string;
    totalSpent: string;
    totalSavings: string;
    availableBudget: string;
    remaining: string;
    leftOver: string;
    missing: string;
    totalAnnual: string;
    monthlyAverage: string;
    netBalance: string;
    accumulatedBalance: string;
    generalSummary: string;
  };
  banks: {
    title: string;
    subtitle: string;
    totalBalance: string;
    reconciled: string;
    discrepancy: string;
    addAccount: string;
    doRecount: string;
    minBalanceAlert: string;
    calendarAlerts: string;
    purposeFixed: string;
    purposeLeisure: string;
    purposeSavings: string;
    purposeMixed: string;
    purposeCash: string;
    cashOnlyInformative: string;
    cashTitle: string;
  };
  goals: {
    title: string;
    subtitle: string;
    addGoal: string;
    targetAmount: string;
    currentAmount: string;
    remainingToGoal: string;
    completed: string;
    inProgress: string;
    deadline: string;
    monthlyTarget: string;
  };
  stats: {
    title: string;
    subtitle: string;
    incomeVsExpense: string;
    expenseDistribution: string;
    savingsRate: string;
    ruleCompliance: string;
  };
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    concept: string;
    amount: string;
    date: string;
    bank: string;
    notes: string;
    year: string;
    currentYear: string;
    search: string;
    exportCSV: string;
    adjustPercentages: string;
    showMonthDetail: string;
    hideMonthDetail: string;
    monthDetail: string;
    seeDetails: string;
    addMovement: string;
    addExpense: string;
    addIncome: string;
    language: string;
  };
  nav: {
    excel: string;
    banks: string;
    goals: string;
    currentMonth: string;
    annualView: string;
    history: string;
    categories: string;
    recurring: string;
    savings: string;
    stats: string;
    settings: string;
    management: string;
    addMovement: string;
    profile: string;
    logout: string;
  };
}

const DICTIONARY: Record<Language, Translations> = {
  es: {
    months: [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ],
    monthsShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    tables: {
      incomeTitle: '1. PREVISIÓN DE INGRESOS (100%)',
      incomeAdd: '+ Añadir ingreso',
      fixedTitle: '2. PREVISIÓN DE GASTOS FIJOS (40%)',
      fixedAdd: '+ Añadir gasto fijo',
      leisureTitle: '3. PREVISIÓN DE GASTOS OCIO Y VARIABLES (30%)',
      leisureAdd: '+ Añadir gasto ocio',
      savingsTitle: '4. PREVISIÓN DE INVERSIONES Y AHORRO (30%)',
      savingsAdd: '+ Añadir ahorro/inversión',
      totalEarned: 'TOTAL INGRESOS:',
      totalSpent: 'TOTAL GASTADO:',
      totalSavings: 'TOTAL INVERTIDO / AHORRO:',
      availableBudget: 'PRESUPUESTO DISPONIBLE:',
      remaining: 'RESTANTE:',
      leftOver: 'SOBRA',
      missing: 'FALTA',
      totalAnnual: 'TOTAL AÑO',
      monthlyAverage: 'MEDIA / MES',
      netBalance: 'RESULTADO NETO:',
      accumulatedBalance: 'SALDO ACUMULADO (CAJA):',
      generalSummary: 'RESUMEN GENERAL Y BALANCE ANUAL',
    },
    banks: {
      title: 'Bancos y Cuentas',
      subtitle: 'Visualiza en un solo lugar todo tu dinero real, cuadre de cuentas y previsiones de saldo mínimo.',
      totalBalance: 'Patrimonio Total en Cuentas',
      reconciled: 'Cuadre exacto con tesorería',
      discrepancy: 'Diferencia a revisar',
      addAccount: '+ Nueva Cuenta',
      doRecount: 'Hacer Recuento / Cuadre',
      minBalanceAlert: 'Avisos de Saldo Mínimo',
      calendarAlerts: 'Calendario de Recibos y Vencimientos',
      purposeFixed: 'Gastos Fijos',
      purposeLeisure: 'Ocio y Variables',
      purposeSavings: 'Ahorro e Inversión',
      purposeMixed: 'Cuenta Mixta',
      purposeCash: 'Efectivo (Informativo)',
      cashOnlyInformative: 'Solo informativo · No cuenta para cálculos ni cuadre',
      cashTitle: 'Dinero en Efectivo',
    },
    goals: {
      title: 'Metas y Objetivos Anuales',
      subtitle: 'Define metas para este año (ej. 1.000€ para un coche en ocio) y comprueba si has llegado a ellas.',
      addGoal: '+ Nueva Meta',
      targetAmount: 'Objetivo',
      currentAmount: 'Ahorrado',
      remainingToGoal: 'Faltan para la meta',
      completed: '¡Meta conseguida! 🎉',
      inProgress: 'En progreso',
      deadline: 'Fecha límite',
      monthlyTarget: 'Ahorro mensual necesario',
    },
    stats: {
      title: 'Gráficos y Estadísticas',
      subtitle: 'Análisis visual de tus finanzas: ingresos, evolución de gastos, cumplimiento de la regla 40/30/30.',
      incomeVsExpense: 'Ingresos vs Gastos Mensuales',
      expenseDistribution: 'Distribución de Gastos por Partida',
      savingsRate: 'Tasa de Ahorro Conseguida',
      ruleCompliance: 'Cumplimiento de Objetivos (40 / 30 / 30)',
    },
    common: {
      save: 'Guardar',
      cancel: 'Cancelar',
      delete: 'Eliminar',
      edit: 'Editar',
      concept: 'Concepto',
      amount: 'Importe',
      date: 'Fecha',
      bank: 'Banco',
      notes: 'Notas',
      year: 'Año',
      currentYear: 'Año actual',
      search: 'Buscar concepto...',
      exportCSV: 'Exportar CSV',
      adjustPercentages: 'Ajustar porcentajes',
      showMonthDetail: 'Ver Detalle Mes',
      hideMonthDetail: 'Ocultar Detalle Mes',
      monthDetail: 'Detalle del Mes',
      seeDetails: 'Ver desglose',
      addMovement: 'Añadir movimiento',
      addExpense: 'Registrar gasto',
      addIncome: 'Registrar ingreso',
      language: 'Idioma',
    },
    nav: {
      excel: 'Hoja Excel Anual',
      banks: 'Bancos y Cuentas',
      goals: 'Metas Anuales',
      currentMonth: 'Mes actual',
      annualView: 'Vista anual',
      history: 'Historial',
      categories: 'Categorías',
      recurring: 'Periódicos',
      savings: 'Ahorros',
      stats: 'Estadísticas',
      settings: 'Configuración',
      management: 'Gestión',
      addMovement: 'Añadir movimiento',
      profile: 'Perfil y privacidad',
      logout: 'Cerrar sesión',
    },
  },
  ca: {
    months: [
      'Gener',
      'Febrer',
      'Març',
      'Abril',
      'Maig',
      'Juny',
      'Juliol',
      'Agost',
      'Setembre',
      'Octubre',
      'Novembre',
      'Desembre',
    ],
    monthsShort: ['Gen', 'Feb', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Des'],
    tables: {
      incomeTitle: "1. PREVISIÓ D'INGRESSOS (100%)",
      incomeAdd: '+ Afegir ingrés',
      fixedTitle: '2. PREVISIÓ DE DESPESES FIXES (40%)',
      fixedAdd: '+ Afegir despesa fixa',
      leisureTitle: '3. PREVISIÓ DE DESPESES OPCIONALS (30%)',
      leisureAdd: '+ Afegir despesa opcional',
      savingsTitle: '4. PREVISIÓ DE DESPESES PROVISIONALS/ESTALVI (30%)',
      savingsAdd: '+ Afegir estalvi/inversió',
      totalEarned: 'TOTAL INGRESSOS:',
      totalSpent: 'TOTAL GASTAT:',
      totalSavings: 'TOTAL INVERTIT / ESTALVI:',
      availableBudget: 'PRESSUPOST DISPONIBLE:',
      remaining: 'RESTANT:',
      leftOver: 'SOBRA',
      missing: 'MANCA',
      totalAnnual: 'TOTAL ANY',
      monthlyAverage: 'MITJANA / MES',
      netBalance: 'RESULTAT NET:',
      accumulatedBalance: 'SALDO ACUMULAT (CAIXA):',
      generalSummary: 'RESUM GENERAL I RESULTAT NET',
    },
    banks: {
      title: 'Bancs i Comptes',
      subtitle: 'Visualitza en un sol lloc tots els teus diners reals, quadratura de comptes i previsions de saldo mínim.',
      totalBalance: 'Patrimoni Total als Comptes',
      reconciled: 'Quadratura exacta amb la tresoreria',
      discrepancy: 'Diferència a revisar',
      addAccount: '+ Nou Compte',
      doRecount: 'Fer Recompte / Quadratura',
      minBalanceAlert: 'Avisos de Saldo Mínim',
      calendarAlerts: 'Calendari de Rebuts i Venciments',
      purposeFixed: 'Despeses Fixes',
      purposeLeisure: 'Opcional i Variables',
      purposeSavings: 'Estalvi i Inversió',
      purposeMixed: 'Compte Mixt',
      purposeCash: 'Efectiu (Informatiu)',
      cashOnlyInformative: 'Només informatiu · No compta per a càlculs ni quadratura',
      cashTitle: 'Diners en Efectiu',
    },
    goals: {
      title: 'Metes i Objectius Anuals',
      subtitle: 'Defineix metes per a aquest any (ex. 1.000€ per a un cotxe en opcional) i comprova si hi has arribat.',
      addGoal: '+ Nova Meta',
      targetAmount: 'Objectiu',
      currentAmount: 'Estalviat',
      remainingToGoal: 'Falten per a la meta',
      completed: 'Meta aconseguida! 🎉',
      inProgress: 'En curs',
      deadline: 'Data límit',
      monthlyTarget: 'Estalvi mensual necessari',
    },
    stats: {
      title: 'Gràfics i Estadístiques',
      subtitle: 'Anàlisi visual de les teves finances: ingressos, evolució de despeses i compliment de la regla 40/30/30.',
      incomeVsExpense: 'Ingressos vs Despeses Mensuals',
      expenseDistribution: 'Distribució de Despeses per Partida',
      savingsRate: "Taxa d'Estalvi Aconseguida",
      ruleCompliance: 'Compliment dels Objectius (40 / 30 / 30)',
    },
    common: {
      save: 'Desar',
      cancel: 'Cancel·lar',
      delete: 'Eliminar',
      edit: 'Editar',
      concept: 'Concepte',
      amount: 'Import',
      date: 'Data',
      bank: 'Banc',
      notes: 'Notes',
      year: 'Any',
      currentYear: 'Any actual',
      search: 'Cercar concepte...',
      exportCSV: 'Exportar CSV',
      adjustPercentages: 'Ajustar percentatges',
      showMonthDetail: 'Veure Detall Mes',
      hideMonthDetail: 'Amagar Detall Mes',
      monthDetail: 'Detall del Mes',
      seeDetails: 'Veure desglossament',
      addMovement: 'Afegir moviment',
      addExpense: 'Registrar despesa',
      addIncome: 'Registrar ingrés',
      language: 'Idioma',
    },
    nav: {
      excel: 'Full Excel Anual',
      banks: 'Bancs i Comptes',
      goals: 'Metes Anuals',
      currentMonth: 'Mes actual',
      annualView: 'Vista anual',
      history: 'Historial',
      categories: 'Categories',
      recurring: 'Periòdics',
      savings: 'Estalvis',
      stats: 'Estadístiques',
      settings: 'Configuració',
      management: 'Gestió',
      addMovement: 'Afegir moviment',
      profile: 'Perfil i privadesa',
      logout: 'Tancar sessió',
    },
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    return saved === 'ca' ? 'ca' : 'es'; // default Spanish as requested
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
  };

  const toggleLanguage = () => {
    const next = language === 'es' ? 'ca' : 'es';
    setLanguage(next);
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t: DICTIONARY[language],
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage debe usarse dentro de un LanguageProvider');
  }
  return context;
}
