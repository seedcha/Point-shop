"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type StudentProfile = {
  id: string;
  department_id: string;
  name: string;
  parent_phone: string;
  grade: string;
  points: number;
  created_at: string;
};

type PointTransaction = {
  id: string;
  created_at: string;
  reason: string;
  amount: number;
  transaction_type: string;
};

type PurchaseHistory = {
  id: string;
  created_at: string;
  product_name: string;
  quantity: number;
  dp_spent: number;
  status: string;
};

type Product = {
  id: string;
  name: string;
  category: string | null;
  price_dp: number;
  stock: number;
  emoji: string | null;
  image_url: string | null;
};

const mypageTabs = [
  { id: "basic", label: "기본 정보" },
  { id: "points", label: "포인트 내역" },
  { id: "purchases", label: "구매 내역" },
] as const;

type MypageTab = (typeof mypageTabs)[number]["id"];

const shopCategories = ["전체", "3D프린터", "간식류", "문구류"] as const;
type ShopCategory = (typeof shopCategories)[number];

function formatKoreaDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function Dashboard() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId");
  const [activeMenu, setActiveMenu] = useState<"mypage" | "shop">("mypage");
  const [activeMypageTab, setActiveMypageTab] = useState<MypageTab>("basic");
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [pointTransactions, setPointTransactions] = useState<PointTransaction[]>([]);
  const [purchases, setPurchases] = useState<PurchaseHistory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeShopCategory, setActiveShopCategory] = useState<ShopCategory>("전체");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [message, setMessage] = useState("");
  const statusMessage = studentId ? message : "학생 로그인 정보가 없습니다.";
  const filteredProducts =
    activeShopCategory === "전체"
      ? products
      : products.filter((product) => product.category === activeShopCategory);

  useEffect(() => {
    if (!studentId) {
      return;
    }

    const loadStudent = async () => {
      const response = await fetch(`/api/student/profile?studentId=${studentId}`);

      if (!response.ok) {
        setMessage("학생 정보를 불러오지 못했습니다.");
        return;
      }

      const payload = (await response.json()) as { student: StudentProfile };
      setStudent(payload.student);
    };

    loadStudent();
  }, [studentId]);

  useEffect(() => {
    if (!studentId) {
      return;
    }

    const loadActivity = async () => {
      const response = await fetch(`/api/student/activity?studentId=${studentId}`);

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        pointTransactions: PointTransaction[];
        purchases: PurchaseHistory[];
      };

      setPointTransactions(payload.pointTransactions);
      setPurchases(payload.purchases);
    };

    loadActivity();
  }, [studentId]);

  useEffect(() => {
    if (!studentId) {
      return;
    }

    const loadProducts = async () => {
      const response = await fetch(`/api/student/products?studentId=${studentId}`);

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { products: Product[] };
      setProducts(payload.products);
    };

    loadProducts();
  }, [studentId]);

  const refreshStudentData = async () => {
    if (!studentId) {
      return;
    }

    const [profileResponse, activityResponse, productResponse] = await Promise.all([
      fetch(`/api/student/profile?studentId=${studentId}`),
      fetch(`/api/student/activity?studentId=${studentId}`),
      fetch(`/api/student/products?studentId=${studentId}`),
    ]);

    if (profileResponse.ok) {
      const payload = (await profileResponse.json()) as { student: StudentProfile };
      setStudent(payload.student);
    }

    if (activityResponse.ok) {
      const payload = (await activityResponse.json()) as {
        pointTransactions: PointTransaction[];
        purchases: PurchaseHistory[];
      };
      setPointTransactions(payload.pointTransactions);
      setPurchases(payload.purchases);
    }

    if (productResponse.ok) {
      const payload = (await productResponse.json()) as { products: Product[] };
      setProducts(payload.products);
    }
  };

  const handlePurchase = async () => {
    if (!studentId || !selectedProduct) {
      return;
    }

    setIsPurchasing(true);

    const response = await fetch("/api/student/purchases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ studentId, productId: selectedProduct.id }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      alert(payload?.error ?? "상품을 구매하지 못했습니다.");
      setIsPurchasing(false);
      return;
    }

    await refreshStudentData();
    setSelectedProduct(null);
    setIsPurchasing(false);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="z-10 flex w-64 flex-col border-r border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 p-8 text-center">
          <h1 className="text-2xl font-black tracking-wider text-blue-600">
            POINT
            <br />
            SYSTEM
          </h1>
        </div>

        <nav className="flex-1 space-y-2 p-4">
          <button
            onClick={() => setActiveMenu("mypage")}
            className={`flex w-full items-center gap-4 rounded-2xl px-6 py-4 font-bold transition-all ${
              activeMenu === "mypage"
                ? "bg-blue-600 text-white shadow-lg"
                : "text-slate-400 hover:bg-slate-100"
            }`}
          >
            마이페이지
          </button>
          <button
            onClick={() => setActiveMenu("shop")}
            className={`flex w-full items-center gap-4 rounded-2xl px-6 py-4 font-bold transition-all ${
              activeMenu === "shop"
                ? "bg-blue-600 text-white shadow-lg"
                : "text-slate-400 hover:bg-slate-100"
            }`}
          >
            상점 입장
          </button>
        </nav>

        <div className="border-t border-slate-100 p-6">
          <Link href="/lobby">
            <button className="w-full rounded-xl bg-red-50 py-3 text-sm font-bold text-red-400 transition hover:bg-red-100">
              로그아웃
            </button>
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-10">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">
              {activeMenu === "mypage" ? "마이페이지" : "상점 입장"}
            </h2>
            <p className="mt-1 font-medium text-slate-400">
              {student ? `${student.name} 학생, 오늘도 즐겁게 배워봐요!` : statusMessage}
            </p>
          </div>
          <div className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white px-8 py-4 shadow-sm">
            <span className="font-bold text-slate-500">보유 포인트</span>
            <span className="text-3xl font-black text-blue-600">
              {(student?.points ?? 0).toLocaleString()} DP
            </span>
          </div>
        </header>

        {activeMenu === "mypage" && (
          <section className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm">
            <div className="mb-8 flex flex-wrap gap-3">
              {mypageTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveMypageTab(tab.id)}
                  className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
                    activeMypageTab === tab.id
                      ? "bg-blue-600 text-white shadow-lg"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeMypageTab === "basic" && (
              <div>
                <h3 className="mb-6 text-xl font-bold text-slate-800">기본 정보</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <InfoTile label="이름" value={student?.name ?? "-"} />
                  <InfoTile label="현재 포인트" value={`${(student?.points ?? 0).toLocaleString()} DP`} />
                  <InfoTile label="등록일" value={formatKoreaDate(student?.created_at)} />
                </div>
              </div>
            )}

            {activeMypageTab === "points" && (
              <div>
                <PointHeader points={student?.points ?? 0} />
                <div className="space-y-3">
                  {pointTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="grid gap-3 rounded-2xl bg-slate-50 px-5 py-4 md:grid-cols-[180px_1fr_160px] md:items-center"
                    >
                      <span className="text-sm font-bold text-slate-400">
                        {formatKoreaDate(transaction.created_at)}
                      </span>
                      <span className="font-bold text-slate-700">{transaction.reason}</span>
                      <span
                        className={`text-right text-lg font-black ${
                          transaction.amount >= 0 ? "text-blue-600" : "text-red-500"
                        }`}
                      >
                        {transaction.amount > 0 ? "+" : ""}
                        {transaction.amount.toLocaleString()} DP
                      </span>
                    </div>
                  ))}
                  {!pointTransactions.length && <EmptyState message="포인트 내역이 없습니다." />}
                </div>
              </div>
            )}

            {activeMypageTab === "purchases" && (
              <div>
                <PointHeader points={student?.points ?? 0} />
                <div className="space-y-3">
                  {purchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="grid gap-3 rounded-2xl bg-slate-50 px-5 py-4 md:grid-cols-[180px_1fr_160px] md:items-center"
                    >
                      <span className="text-sm font-bold text-slate-400">
                        {formatKoreaDate(purchase.created_at)}
                      </span>
                      <span className="font-bold text-slate-700">
                        {purchase.product_name}
                        {purchase.quantity > 1 ? ` ${purchase.quantity}개` : ""}
                      </span>
                      <span className="text-right text-lg font-black text-red-500">
                        -{purchase.dp_spent.toLocaleString()} DP
                      </span>
                    </div>
                  ))}
                  {!purchases.length && <EmptyState message="구매 내역이 없습니다." />}
                </div>
              </div>
            )}
          </section>
        )}

        {activeMenu === "shop" && (
          <section className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <PointHeader points={student?.points ?? 0} />
              <div className="flex flex-wrap gap-3">
                {shopCategories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setActiveShopCategory(category)}
                    className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
                      activeShopCategory === category
                        ? "bg-blue-600 text-white shadow-lg"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[calc(100vh-270px)] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className="min-h-48 rounded-3xl bg-slate-50 p-5 text-left transition hover:bg-white hover:shadow-xl"
                  >
                    <div className="mb-4 flex h-24 items-center justify-center rounded-2xl bg-white text-6xl">
                      {product.image_url ? (
                        <span
                          className="h-full w-full rounded-2xl bg-cover bg-center"
                          style={{ backgroundImage: `url(${product.image_url})` }}
                        />
                      ) : (
                        product.emoji ?? "상품"
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-lg font-black text-slate-900">{product.name}</p>
                      <p className="font-black text-blue-600">{product.price_dp.toLocaleString()} DP</p>
                      <p className="text-xs font-bold text-slate-400">재고 {product.stock.toLocaleString()}개</p>
                    </div>
                  </button>
                ))}
              </div>
              {!filteredProducts.length && <EmptyState message="표시할 상품이 없습니다." />}
            </div>
          </section>
        )}
      </main>

      {selectedProduct && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/40 p-6">
          <section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex h-72 items-center justify-center rounded-3xl bg-slate-100 text-8xl">
              {selectedProduct.image_url ? (
                <span
                  className="h-full w-full rounded-3xl bg-cover bg-center"
                  style={{ backgroundImage: `url(${selectedProduct.image_url})` }}
                />
              ) : (
                selectedProduct.emoji ?? "상품"
              )}
            </div>
            <div className="mb-6">
              <p className="text-sm font-black text-slate-400">{selectedProduct.category ?? "상품"}</p>
              <h3 className="mt-1 text-2xl font-black text-slate-900">{selectedProduct.name}</h3>
              <p className="mt-2 text-xl font-black text-blue-600">
                {selectedProduct.price_dp.toLocaleString()} DP
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handlePurchase}
                disabled={isPurchasing}
                className="rounded-2xl bg-blue-600 py-4 font-black text-white transition hover:bg-blue-700 disabled:bg-slate-300"
              >
                {isPurchasing ? "구매 중" : "물품 구매"}
              </button>
              <button
                onClick={() => setSelectedProduct(null)}
                disabled={isPurchasing}
                className="rounded-2xl bg-slate-100 py-4 font-black text-slate-500 transition hover:bg-slate-200 disabled:text-slate-300"
              >
                닫기
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="mb-1 text-sm font-bold text-slate-400">{label}</p>
      <p className="text-lg font-black text-slate-700">{value}</p>
    </div>
  );
}

function PointHeader({ points }: { points: number }) {
  return (
    <div className="mb-5 inline-flex items-center gap-3 rounded-2xl bg-blue-50 px-5 py-3">
      <span className="text-sm font-black text-blue-500">현재 포인트</span>
      <span className="text-2xl font-black text-blue-700">{points.toLocaleString()} DP</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-5 py-10 text-center font-bold text-slate-400">
      {message}
    </div>
  );
}
