import React, { useState } from 'react';
import { Sparkles, HelpCircle, ChevronDown, ChevronUp, Copy, Check, Eye } from 'lucide-react';
import {
  AVAILABLE_TEMPLATE_TAGS,
  TemplateTagDefinition,
  renderTemplateWithContext,
  TemplateContext,
} from '../utils/templateHelper';

interface TemplateTagsHelperProps {
  onInsertTag: (tag: string) => void;
  previewText?: string;
  previewContext?: TemplateContext;
  previewTitle?: string;
  targetFieldLabel?: string;
  className?: string;
}

export const TemplateTagsHelper: React.FC<TemplateTagsHelperProps> = ({
  onInsertTag,
  previewText = '',
  previewContext,
  previewTitle = 'Pré-visualização da discriminação para a emissão:',
  targetFieldLabel = 'discriminação dos serviços',
  className = '',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Datas e Período');
  const [showFullGuide, setShowFullGuide] = useState<boolean>(false);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  const categories = [
    'Datas e Período',
    'Cliente',
    'NFS-e / Fiscal',
    'Valores',
    'Prestador',
    'Todas as Tags',
  ];

  const filteredTags =
    selectedCategory === 'Todas as Tags'
      ? AVAILABLE_TEMPLATE_TAGS
      : AVAILABLE_TEMPLATE_TAGS.filter((t) => t.category === selectedCategory);

  const handleCopyOrInsert = (tag: string) => {
    onInsertTag(tag);
    setCopiedTag(tag);
    setTimeout(() => {
      setCopiedTag(null);
    }, 1500);
  };

  const renderedPreview = previewText && previewContext
    ? renderTemplateWithContext(previewText, previewContext)
    : '';

  return (
    <div className={`space-y-2 mt-2 ${className}`}>
      {/* Barra de Filtro de Categorias de Tags */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-blue-600" />
            Tags dinâmicas para a {targetFieldLabel}:
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowFullGuide((prev) => !prev)}
          className="text-[10px] text-blue-700 hover:text-blue-900 font-medium flex items-center gap-0.5 cursor-pointer"
        >
          <HelpCircle className="w-3 h-3" />
          <span>{showFullGuide ? 'Ocultar guia' : 'Ver guia completo de tags'}</span>
          {showFullGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Tabs de Categorias Rápidas */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 pb-1.5">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white font-semibold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Pills de Tags para Inserção com 1 Clique */}
      <div className="flex flex-wrap items-center gap-1.5">
        {filteredTags.map((item: TemplateTagDefinition) => {
          const isCopied = copiedTag === item.tag;
          return (
            <button
              type="button"
              key={item.tag}
              onClick={() => handleCopyOrInsert(item.tag)}
              title={`${item.label} (Exemplo: ${item.example}) - Clique para inserir`}
              className={`group inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                isCopied
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                  : 'bg-white hover:bg-blue-50 border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 shadow-2xs'
              }`}
            >
              {isCopied ? (
                <Check className="w-3 h-3 text-emerald-600 shrink-0" />
              ) : (
                <span className="text-blue-500 font-bold shrink-0">+</span>
              )}
              <span className="font-semibold">{item.tag}</span>
              <span className="text-[9px] text-slate-400 group-hover:text-blue-600/70 border-l border-slate-200 pl-1 font-sans">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Guia Completo Expansível */}
      {showFullGuide && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs animate-in fade-in duration-150">
          <div className="font-semibold text-slate-800 flex items-center justify-between">
            <span>Tabela de Referência de Tags e Exemplos Práticos</span>
            <span className="text-[10px] text-slate-500">
              As mesmas tags funcionam na Discriminação e no Disparo de E-mail
            </span>
          </div>
          <div className="max-h-56 overflow-y-auto border border-slate-200 rounded bg-white">
            <table className="w-full text-[11px] text-left">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="py-1 px-2 font-mono">Tag</th>
                  <th className="py-1 px-2">Significado</th>
                  <th className="py-1 px-2">Exemplo no Sistema</th>
                  <th className="py-1 px-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {AVAILABLE_TEMPLATE_TAGS.map((t) => (
                  <tr key={t.tag} className="hover:bg-blue-50/50">
                    <td className="py-1 px-2 font-mono text-blue-700 font-medium whitespace-nowrap">
                      {t.tag}
                    </td>
                    <td className="py-1 px-2 text-slate-700">{t.description || t.label}</td>
                    <td className="py-1 px-2 text-slate-500 italic font-mono text-[10px]">
                      {t.example}
                    </td>
                    <td className="py-1 px-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleCopyOrInsert(t.tag)}
                        className="px-1.5 py-0.5 text-[10px] bg-slate-100 hover:bg-blue-600 hover:text-white rounded border border-slate-200 transition-colors"
                      >
                        Inserir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pré-visualização em Tempo Real com Dados Reais Resolvidos */}
      {previewText && (previewText.includes('{') || previewText.toLowerCase().includes('período')) && (
        <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg shadow-2xs space-y-1 animate-in fade-in duration-100">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-blue-950 flex items-center gap-1 uppercase tracking-wider">
              <Eye className="w-3 h-3 text-blue-700" />
              {previewTitle}
            </span>
            <span className="text-[9px] bg-blue-200/70 text-blue-900 px-1.5 py-0.2 rounded font-medium">
              Fuso Horário Oficial de Brasília
            </span>
          </div>
          <div className="text-[11px] text-slate-800 font-mono whitespace-pre-wrap leading-relaxed bg-white/90 p-2 rounded border border-blue-100">
            {renderedPreview || previewText}
          </div>
        </div>
      )}
    </div>
  );
};
