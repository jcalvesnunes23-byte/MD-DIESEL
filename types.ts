
export enum VehicleType {
  TRUCK = 'Caminhão',
  BUS = 'Ônibus',
  MACHINE = 'Máquina'
}

export enum PaymentMethod {
  CASH = 'Dinheiro',
  PIX = 'Pix',
  CARD = 'Cartão',
  TRANSFER = 'Transferência'
}

export enum PaymentStatus {
  PAID = 'Pago',
  PENDING = 'Pendente'
}

export interface ServiceItem {
  description: string;
  value: number;
}

export interface ServiceOrder {
  id: string;
  date: string;
  company: {
    name: string;
    cnpj: string;
    phone: string;
    logoUrl?: string;
  };
  client: {
    name: string;
    idNumber: string;
    phone: string;
  };
  mechanic: {
    name: string;
    idNumber: string;
  };
  vehicle: {
    type: VehicleType;
    brand: string;
    model: string;
    plate: string;
    mileage: string;
  };
  serviceDescription: string;
  serviceItems?: ServiceItem[];
  values: {
    labor: number;
    travel: number;
  };
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  observations: string;
  signatures: {
    client: string;
    mechanic: string;
  };
}
