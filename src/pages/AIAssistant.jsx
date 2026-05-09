import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, User, ChevronRight } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { useData, getLocalYMD, parseNumber } from '../context/DataContext';
import { designKnowledge } from '../data/knowledgeBase';

const getContextualQuestions = (tab) => {
  // Preguntas basadas en las 97 consultas reales de abril–mayo 2025
  switch (tab) {
    case 'capacity':
      return [
        "¿Qué talleres tienen capacidad disponible?",
        "¿Hay riesgo de saturación la próxima semana?",
        "¿Quién tiene más espacio para 3000 imp?",
      ];
    case 'logistics':
      return [
        "¿Qué pedidos se despachan hoy?",
        "¿A qué hora llegan los pedidos de hoy AM u PM?",
        "¿Hay pedidos con fecha de entrega pasada sin llegar?",
      ];
    case 'conflicts':
      return [
        "¿Cuáles son los pedidos críticos o atrasados?",
        "¿Qué taller tiene más pedidos críticos?",
        "¿Hay pedidos con VB pendiente que se retiran pronto?",
      ];
    default:
      return [
        "¿Qué pedidos se despachan hoy?",
        "¿A qué hora llegan los pedidos AM u PM?",
        "¿Cuáles son los pedidos críticos o atrasados?",
      ];
  }
};

const AIAssistant = ({ contextTab = 'tower' }) => {
  const { data: mockConsolidatedData, talleres, isLoading } = useData();
  const presetQuestions = getContextualQuestions(contextTab);
  const getTalleres = () => talleres;

  const [messages, setMessages] = useState([
    { id: 1, role: 'ai', text: '¡Hola! Soy la Control Tower AI. Estoy monitoreando en directo tus indicadores conectada a Google Sheets y tus límites de capacidad. ¿En qué te ayudo?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const mockResponses = {
    "¿Qué talleres tienen capacidad disponible?": () => {
      const ts = talleres;
      const activos = mockConsolidatedData.filter(p => !p.fecha_retiro_real);
      const msgs = ts.map(t => {
        const imps = activos.filter(p => p.taller === t.nombre).reduce((acc, p) => acc + (parseNumber(p.impresiones) || parseNumber(p.unidades)), 0);
        const capPct = t.capacidad_semanal_impresiones > 0 ? (imps / t.capacidad_semanal_impresiones) * 100 : 0;

        // Cálculo rápido de Health Score para la respuesta
        const pedidosArr = activos.filter(p => p.taller === t.nombre);
        const atrasoPromedio = pedidosArr.length > 0 ? (pedidosArr.reduce((acc, p) => acc + parseNumber(p.dias_retraso), 0) / pedidosArr.length) : 0;
        let score = 100 - (capPct > 80 ? (capPct - 80) * 2 : 0) - (atrasoPromedio * 15);
        score = Math.max(0, Math.min(100, Math.round(score)));

        return `**${t.nombre}**: ${Math.max(0, 100 - capPct).toFixed(1)}% libre (Health Score: ${score}).`;
      });
      return `Analizando la red operativa, esta es la disponibilidad actual:\n\n${msgs.join('\n')}\n\nLos talleres con Score > 85 son los más recomendados para nuevas asignaciones.`;
    },
    "¿Hay riesgo de saturación la próxima semana?": () => {
      const ts = talleres;
      const activos = mockConsolidatedData.filter(p => !p.fecha_retiro_real);
      const hoy = new Date();
      const proximaSemana = new Date(); proximaSemana.setDate(hoy.getDate() + 7);
      const dosSemanas = new Date(); dosSemanas.setDate(hoy.getDate() + 14);

      let alertas = [];
      ts.forEach(t => {
        const cargaFutura = activos.filter(p => {
          const f = new Date(p.fecha_retiro_ideal);
          return f > proximaSemana && f <= dosSemanas && p.taller === t.nombre;
        }).reduce((acc, p) => acc + (parseNumber(p.impresiones) || parseNumber(p.unidades)), 0);

        if (cargaFutura > (t.capacidad_semanal_impresiones * 0.8)) {
          alertas.push(`⚠️ **${t.nombre}**: Alta concentración de retiros proyectada para la semana subsiguiente (${cargaFutura.toLocaleString()} imp).`);
        }
      });

      if (alertas.length === 0) return "He analizado la carga proyectada para los próximos 14 días y no detecto riesgos inminentes de saturación. La red está equilibrada.";
      return `### Análisis de Riesgo Proyectado 🧠\n\nHe detectado los siguientes cuellos de botella en formación:\n\n${alertas.join('\n')}\n\nSe recomienda adelantar producciones o negociar fechas antes de que se confirme más carga.`;
    },
    "¿Cuáles son los pedidos críticos o atrasados?": () => {
      const todayStr = getLocalYMD();
      const atrasados = mockConsolidatedData.filter(p => !p.fecha_retiro_real && p.fecha_retiro_ideal < todayStr);
      if (atrasados.length === 0) return "Cero pedidos vencidos detectados. ¡La producción va según lo ideal!";

      const porTaller = atrasados.reduce((acc, p) => {
        acc[p.taller] = (acc[p.taller] || 0) + 1;
        return acc;
      }, {});

      const lista = Object.entries(porTaller).map(([t, count]) => `- **${t}**: ${count} ${count === 1 ? 'pedido atrasado' : 'pedidos atrasados'}`).join('\n');
      return `He detectado ${atrasados.length} pedidos fuera de plazo:\n\n${lista}\n\nLos detalles específicos están resaltados en la tabla de Conflictos.`;
    },
    "¿Puede Pintapack tomar 5000 impresiones urgentes?": () => {
      const t = talleres.find(t => t.nombre.includes('Pintapack'));
      if (!t) return "No encuentro datos de ese taller en la configuración actual.";

      const activos = mockConsolidatedData.filter(p => !p.taller === t.nombre && !p.fecha_retiro_real);
      const imps = activos.reduce((acc, p) => acc + (parseNumber(p.impresiones) || parseNumber(p.unidades)), 0);
      const futurePct = t.capacidad_semanal_impresiones > 0 ? ((imps + 5000) / t.capacidad_semanal_impresiones) * 100 : 100;

      if (futurePct > 85) {
        return `⛔ **Efecto de Riesgo**: Añadir 5.000 impresiones llevaría a **${t.nombre}** al **${futurePct.toFixed(1)}%** de carga. Esto impactaría negativamente en su Score de Salud.\n\nBusca un proveedor con carga < 60% en la pestaña de Capacidad.`;
      } else {
        return `✅ **Factible**: El taller **${t.nombre}** quedaría en un **${futurePct.toFixed(1)}%** de ocupación. Tienen espacio para absorber este pedido sin comprometer la red.`;
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-accent animate-spin mb-4"></div>
        <p>Iniciando red neuronal operativa...</p>
      </div>
    );
  }

  const buildSystemContext = () => {
    const today = getLocalYMD();
    const activos = mockConsolidatedData.filter(p => !p.fecha_retiro_real);
    const atrasados = activos.filter(p => p.fecha_retiro_ideal < today).length;

    const tallerResumen = talleres.map(t => {
      const pedidosTaller = activos.filter(p => p.taller === t.nombre);
      const imps = pedidosTaller.reduce((a, p) => a + parseNumber(p.impresiones), 0);
      const pct = t.capacidad_semanal_impresiones > 0
        ? Math.round((imps / t.capacidad_semanal_impresiones) * 100)
        : 0;
      return `${t.nombre}: ${pedidosTaller.length} pedidos, ${imps.toLocaleString()} imp, ${pct}% cap.`;
    }).join('\n');

    const pedidosSample = activos.slice(0, 30).map(p =>
      `#${p.pedido_id} | ${p.nombre_proyecto} | ${p.taller} | ${p.estado_produccion} | retiro: ${p.fecha_retiro_ideal}`
    ).join('\n');

    // Pedidos con despacho hoy y mañana para contexto de entrega
    const todayStr = today;
    const tmrrw = new Date(); tmrrw.setDate(tmrrw.getDate() + 1);
    const tmrrwStr = `${tmrrw.getFullYear()}-${String(tmrrw.getMonth()+1).padStart(2,'0')}-${String(tmrrw.getDate()).padStart(2,'0')}`;
    const despachosHoy = mockConsolidatedData.filter(p => p.fecha_entrega === todayStr || p.fecha_entrega_cliente === todayStr);
    const despachosMañana = mockConsolidatedData.filter(p => p.fecha_entrega === tmrrwStr || p.fecha_entrega_cliente === tmrrwStr);

    return `Eres un asistente operativo de la empresa Yute Impresiones. Ayudas al equipo KAM y de operaciones a gestionar pedidos de producción textil/serigrafía.

HORARIOS DE ENTREGA (información crítica — siempre incluir cuando pregunten por hora):
- Estado "Envío AM Oficina" → llegada aproximada 11:45 hrs en la oficina del cliente
- Estado "Envío PM Oficina" → llegada aproximada 17:30 hrs en la oficina del cliente
- Si el estado no especifica AM o PM, indicar que hay que consultar con logística para confirmar horario.
- Carrier Clickex: entregas en Santiago, misma ruta que define el estado AM/PM.
- Carrier Starken: envíos a regiones, el tracking está disponible en starken.cl con el número de guía.

DATOS AL ${today}:
- Pedidos activos: ${activos.length}
- Pedidos atrasados: ${atrasados}
- Despachos de hoy: ${despachosHoy.length} (${despachosHoy.map(p => `#${p.pedido_id} ${p.estado_logistico || ''}`).join(', ') || 'ninguno'})
- Despachos de mañana: ${despachosMañana.length}

CARGA POR TALLER:
${tallerResumen}

MUESTRA DE PEDIDOS ACTIVOS (máx 30):
${pedidosSample}

Responde en español, de forma concisa y directa. Si el usuario pregunta por un pedido específico, busca en los datos. Si hay pedidos atrasados o en riesgo, menciónalos.`;
  };

  const handleSend = async (presetText) => {
    const textToSend = presetText || input;
    if (!textToSend.trim()) return;

    const newUserMsg = { id: Date.now(), role: 'user', text: textToSend };
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setIsTyping(true);

    // Respuestas locales instantáneas para comparaciones con gráfico
    const textLower = textToSend.toLowerCase();
    if (textLower.includes('comparar') || textLower.includes(' vs ') || textLower.includes('rendimiento')) {
      const chartData = talleres.map(t => {
        const activos = mockConsolidatedData.filter(p => p.taller === t.nombre && !p.fecha_retiro_real);
        const imps = activos.reduce((acc, p) => acc + (parseNumber(p.impresiones) || parseNumber(p.unidades)), 0);
        const atraso = activos.reduce((acc, p) => acc + parseNumber(p.dias_retraso), 0) / (activos.length || 1);
        return { name: t.nombre, impresiones: imps, retraso_promedio: Math.round(atraso * 10) / 10 };
      });
      newUserMsg.chartData = chartData;
      newUserMsg.chartType = 'bar';
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        text: 'He generado un gráfico comparativo de la carga actual y el retraso promedio por taller.',
        chartData,
        chartType: 'bar',
      }]);
      setIsTyping(false);
      return;
    }

    // Respuestas predefinidas locales (sin latencia de API)
    if (mockResponses[textToSend]) {
      const text = mockResponses[textToSend]();
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text }]);
      setIsTyping(false);
      return;
    }

    // Llamada a Anthropic Claude vía /api/chat
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend, systemContext: buildSystemContext() }),
      });
      const json = await res.json();
      const aiText = json.text || json.error || 'Sin respuesta del servidor.';
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: aiText }]);
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        text: 'Error de conexión con el asistente IA. Verifica que ANTHROPIC_API_KEY esté configurada en Vercel.',
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center">
            Asistente Operativo <Sparkles className="w-5 h-5 ml-2 text-accent" />
          </h1>
          <p className="text-slate-500">Consultas operativas cruzando los datos vivos de Sheets</p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'ai' && (
                <div className="w-8 h-8 rounded-full bg-accent-bg text-accent flex items-center justify-center mr-3 mt-1 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed ${msg.role === 'user'
                  ? 'bg-slate-800 text-white rounded-br-sm shadow-md shadow-slate-900/10'
                  : 'bg-slate-50 text-slate-800 border border-slate-200 rounded-bl-sm'
                }`}>
                {msg.text.split('\n').map((line, i) => {
                  if (line.includes('**')) {
                    const parts = line.split('**');
                    return (
                      <div key={i} className={i !== 0 ? 'mt-2' : ''}>
                        {parts.map((p, idx) => idx % 2 !== 0 ? <strong key={idx}>{p}</strong> : p)}
                      </div>
                    );
                  }
                  return <div key={i} className={i !== 0 ? 'mt-3' : ''}>{line}</div>
                })}

                {msg.chartData && (
                  <div className="mt-4 h-64 w-full bg-white rounded-xl p-4 border border-slate-100 shadow-sm overflow-hidden animate-in fade-in zoom-in duration-500">
                    <ResponsiveContainer width="100%" height="100%">
                      {msg.chartType === 'bar' ? (
                        <BarChart data={msg.chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" fontSize={10} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <YAxis fontSize={10} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                            itemStyle={{ color: '#60a5fa' }}
                            cursor={{ fill: '#f1f5f9' }}
                          />
                          <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                          <Bar dataKey="impresiones" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Impresiones" barSize={30} />
                          <Bar dataKey="retraso_promedio" fill="#ef4444" radius={[4, 4, 0, 0]} name="Días Retraso" barSize={30} />
                        </BarChart>
                      ) : (
                        <PieChart>
                          <Pie
                            data={msg.chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {msg.chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][index % 4]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center ml-3 mt-1 shrink-0">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-full bg-accent-bg text-accent flex items-center justify-center mr-3 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-bl-sm px-5 py-4 flex space-x-1.5 items-center">
                <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "300ms" }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 overflow-x-auto whitespace-nowrap hidden sm:flex space-x-2">
          {presetQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="inline-flex items-center px-3 py-1.5 bg-white border border-slate-300 rounded-full text-xs font-medium text-slate-600 hover:border-accent hover:text-accent transition-colors"
            >
              <span>{q}</span>
            </button>
          ))}
        </div>

        <div className="p-4 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex items-center relative"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregúntale a la torre de control en vivo..."
              className="flex-1 border-slate-300 outline-none focus:ring-1 focus:ring-accent focus:border-accent border rounded-full py-3 pl-5 pr-12 text-sm shadow-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="absolute right-2 top-2 p-1.5 bg-accent hover:bg-accent/90 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-full transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="mt-2 text-center">
            <span className="text-[10px] text-slate-400">
              Versión conectada a Google Sheets.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
