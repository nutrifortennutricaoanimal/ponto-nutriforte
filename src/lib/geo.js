const RAIO_TERRA_METROS = 6371000;

function toRad(graus) {
  return (graus * Math.PI) / 180;
}

export function calcularDistanciaMetros(lat1, lng1, lat2, lng2) {
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLng = toRad(Number(lng2) - Number(lng1));
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(Number(lat1))) *
      Math.cos(toRad(Number(lat2))) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return RAIO_TERRA_METROS * c;
}

export function encontrarLocalValido(latitude, longitude, locais) {
  const ativos = (locais || []).filter((l) => l.ativo);
  let melhor = null;

  for (const local of ativos) {
    const distancia = calcularDistanciaMetros(
      latitude,
      longitude,
      local.latitude,
      local.longitude
    );
    if (distancia <= local.raio_metros) {
      if (!melhor || distancia < melhor.distancia) {
        melhor = { local, distancia };
      }
    }
  }

  return melhor;
}

export function getPosicaoAtual(opcoes = {}) {
  const { timeout = 15000, enableHighAccuracy = true } = opcoes;

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalização não suportada neste dispositivo."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        const mensagens = {
          1: "Permissão de localização negada. Ative o GPS nas configurações.",
          2: "Não foi possível obter sua localização. Tente novamente.",
          3: "Tempo esgotado ao obter localização. Tente novamente.",
        };
        reject(new Error(mensagens[err.code] || "Erro ao obter localização."));
      },
      { timeout, enableHighAccuracy, maximumAge: 10000 }
    );
  });
}
