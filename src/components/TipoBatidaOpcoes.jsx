import { TIPOS_BATIDA, TIPO_ICONES, TIPO_LABELS } from "../lib/tipoBatida";

export default function TipoBatidaOpcoes({ value, onChange, grande = false, tipos = TIPOS_BATIDA }) {
  return (
    <div className={`tipo-batida-opcoes${grande ? " tipo-batida-opcoes-grande" : ""}`}>
      {tipos.map((tipo) => (
        <button
          key={tipo}
          type="button"
          className={`tipo-batida-opcao${value === tipo ? " ativa" : ""}`}
          onClick={() => onChange(tipo)}
        >
          <span className="tipo-batida-icone" aria-hidden="true">
            {TIPO_ICONES[tipo]}
          </span>
          <span className="tipo-batida-label">{TIPO_LABELS[tipo]}</span>
        </button>
      ))}
    </div>
  );
}
