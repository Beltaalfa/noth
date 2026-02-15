/**
 * Utilitário de toast usando Sonner.
 * 
 * Exemplos de uso:
 * 
 * import { toast } from "sonner";
 * 
 * // Sucesso
 * toast.success("Cliente salvo com sucesso!");
 * 
 * // Erro
 * toast.error("Erro ao salvar. Tente novamente.");
 * 
 * // Informativo
 * toast.info("Carregando dados...");
 * 
 * // Promessa (loading automático)
 * toast.promise(fetchData(), {
 *   loading: "Salvando...",
 *   success: "Salvo!",
 *   error: "Erro ao salvar",
 * });
 * 
 * // Com ação
 * toast("Item excluído", {
 *   action: { label: "Desfazer", onClick: () => restore() },
 * });
 */
export { toast } from "sonner";
