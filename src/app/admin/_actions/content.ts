"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { adminAction, fd } from "@/server/admin-action";
import type { ActionState } from "@/server/admin-action-types";
import { ValidationError } from "@/server/errors";
import { articles, banners, faqs, pages, redirects, testimonials } from "@/server/db/schema";
import { saveArticle, saveBanner, saveFaq, savePage, saveRedirect, saveTestimonial } from "@/server/services/admin-ops";
import { uploadImage } from "@/server/services/admin-catalog";
import { getSettings, saveSettings } from "@/server/services/settings";
import { parseRupeesToPaise } from "@/lib/money";

export async function saveHomepageAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    const current = await getSettings(ctx.db, "homepage");
    const sections = Object.fromEntries(Object.keys(current.sections).map((k) => [k, fd.bool(form, `section_${k}`)]));
    const whyItems = [];
    for (let i = 0; i < 6; i++) {
      const title = fd.str(form, `why_${i}_title`).trim();
      if (title) whyItems.push({ title, body: fd.str(form, `why_${i}_body`).trim() });
    }
    if (fd.bool(form, "announcementEnabled") && !fd.str(form, "announcementText").trim()) throw new ValidationError("Write the announcement text or turn the announcement off.");
    await saveSettings(ctx.db, "homepage", {
      announcementEnabled: fd.bool(form, "announcementEnabled"),
      announcementText: fd.str(form, "announcementText"),
      announcementHref: fd.str(form, "announcementHref"),
      heroEyebrow: fd.str(form, "heroEyebrow"),
      heroTitle: fd.str(form, "heroTitle") || current.heroTitle,
      heroSubtitle: fd.str(form, "heroSubtitle"),
      heroCtaLabel: fd.str(form, "heroCtaLabel"),
      heroCtaHref: fd.str(form, "heroCtaHref") || "/shop",
      sections,
      featuredCategoryIds: fd.all(form, "featuredCategoryIds"),
      popularProductIds: fd.all(form, "popularProductIds").slice(0, 12),
      dailyCategoryId: fd.str(form, "dailyCategoryId") || null,
      garlandCategoryIds: fd.all(form, "garlandCategoryIds"),
      whyTitle: fd.str(form, "whyTitle") || current.whyTitle,
      whyItems,
      bulkTitle: fd.str(form, "bulkTitle") || current.bulkTitle,
      bulkBody: fd.str(form, "bulkBody"),
    });
    await ctx.audit("settings.homepage", "settings", "homepage");
    return "Home page saved.";
  });
}

export async function saveBannerAction(bannerId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    await saveBanner(
      ctx.db,
      bannerId === "new" ? null : bannerId,
      {
        placement: fd.str(form, "placement"),
        eyebrow: fd.str(form, "eyebrow"),
        title: fd.str(form, "title"),
        subtitle: fd.str(form, "subtitle"),
        ctaLabel: fd.str(form, "ctaLabel"),
        ctaHref: fd.str(form, "ctaHref"),
        imageAlt: fd.str(form, "imageAlt"),
        sortOrder: fd.str(form, "sortOrder"),
        isActive: fd.bool(form, "isActive"),
        startsAt: fd.str(form, "startsAt"),
        endsAt: fd.str(form, "endsAt"),
      },
      fd.file(form, "image"),
    );
    await ctx.audit(bannerId === "new" ? "banner.created" : "banner.updated", "banner", bannerId === "new" ? null : bannerId);
    return "Banner saved.";
  });
}

export async function deleteBannerAction(bannerId: string): Promise<ActionState> {
  return adminAction(async (ctx) => {
    await ctx.db.delete(banners).where(eq(banners.id, bannerId));
    await ctx.audit("banner.deleted", "banner", bannerId);
    return "Banner deleted.";
  });
}

export async function saveFaqAction(faqId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    await saveFaq(ctx.db, faqId === "new" ? null : faqId, {
      question: fd.str(form, "question"),
      answer: fd.str(form, "answer"),
      topic: fd.str(form, "topic"),
      categoryId: fd.str(form, "categoryId"),
      sortOrder: fd.str(form, "sortOrder"),
      isPublished: fd.bool(form, "isPublished"),
    });
    return "Question saved.";
  });
}

export async function deleteFaqAction(faqId: string): Promise<ActionState> {
  return adminAction(async (ctx) => {
    await ctx.db.delete(faqs).where(eq(faqs.id, faqId));
    return "Question deleted.";
  });
}

export async function savePageAction(pageId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  let created = false;
  const state = await adminAction(async (ctx) => {
    await savePage(ctx.db, pageId === "new" ? null : pageId, {
      slug: fd.str(form, "slug"),
      title: fd.str(form, "title"),
      body: fd.str(form, "body"),
      seoTitle: fd.str(form, "seoTitle"),
      seoDescription: fd.str(form, "seoDescription"),
      isPublished: fd.bool(form, "isPublished"),
      showInFooter: fd.bool(form, "showInFooter"),
    });
    await ctx.audit(pageId === "new" ? "page.created" : "page.updated", "page", pageId === "new" ? null : pageId, { slug: fd.str(form, "slug"), published: fd.bool(form, "isPublished") });
    created = pageId === "new";
    return "Page saved.";
  });
  if (created) redirect("/admin/content/pages");
  return state;
}

export async function deletePageAction(pageId: string): Promise<ActionState> {
  let done = false;
  const state = await adminAction(async (ctx) => {
    await ctx.db.delete(pages).where(eq(pages.id, pageId));
    await ctx.audit("page.deleted", "page", pageId);
    done = true;
    return "Page deleted.";
  });
  if (done) redirect("/admin/content/pages");
  return state;
}

export async function saveArticleAction(articleId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  let created = false;
  const state = await adminAction(async (ctx) => {
    await saveArticle(
      ctx.db,
      articleId === "new" ? null : articleId,
      {
        slug: fd.str(form, "slug"),
        title: fd.str(form, "title"),
        excerpt: fd.str(form, "excerpt"),
        body: fd.str(form, "body"),
        coverAlt: fd.str(form, "coverAlt"),
        authorName: fd.str(form, "authorName"),
        relatedCategoryId: fd.str(form, "relatedCategoryId"),
        status: fd.str(form, "status"),
        seoTitle: fd.str(form, "seoTitle"),
        seoDescription: fd.str(form, "seoDescription"),
      },
      fd.file(form, "cover"),
    );
    await ctx.audit(articleId === "new" ? "guide.created" : "guide.updated", "article", articleId === "new" ? null : articleId, { status: fd.str(form, "status") });
    created = articleId === "new";
    return "Guide saved.";
  });
  if (created) redirect("/admin/content/guides");
  return state;
}

export async function deleteArticleAction(articleId: string): Promise<ActionState> {
  let done = false;
  const state = await adminAction(async (ctx) => {
    await ctx.db.delete(articles).where(eq(articles.id, articleId));
    await ctx.audit("guide.deleted", "article", articleId);
    done = true;
    return "Guide deleted.";
  });
  if (done) redirect("/admin/content/guides");
  return state;
}

export async function saveTestimonialAction(id: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    await saveTestimonial(ctx.db, id === "new" ? null : id, {
      customerName: fd.str(form, "customerName"),
      locality: fd.str(form, "locality"),
      body: fd.str(form, "body"),
      rating: fd.str(form, "rating"),
      receivedOn: fd.str(form, "receivedOn"),
      isPublished: fd.bool(form, "isPublished"),
      consentConfirmed: fd.bool(form, "consentConfirmed"),
      sortOrder: fd.str(form, "sortOrder"),
    });
    await ctx.audit(id === "new" ? "review.created" : "review.updated", "testimonial", id === "new" ? null : id, { published: fd.bool(form, "isPublished") });
    return "Review saved.";
  });
}

export async function deleteTestimonialAction(id: string): Promise<ActionState> {
  return adminAction(async (ctx) => {
    await ctx.db.delete(testimonials).where(eq(testimonials.id, id));
    return "Review deleted.";
  });
}

export async function saveRedirectAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    await saveRedirect(ctx.db, { fromPath: fd.str(form, "fromPath"), toPath: fd.str(form, "toPath"), permanent: fd.bool(form, "permanent") });
    await ctx.audit("redirect.saved", "redirect", null, { from: fd.str(form, "fromPath"), to: fd.str(form, "toPath") });
    return "Redirect saved.";
  });
}

export async function deleteRedirectAction(id: string): Promise<ActionState> {
  return adminAction(async (ctx) => {
    await ctx.db.delete(redirects).where(eq(redirects.id, id));
    return "Redirect deleted.";
  });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function saveBusinessAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    const s = (k: string) => fd.str(form, k);
    await saveSettings(ctx.db, "business", {
      name: s("name"),
      tagline: s("tagline"),
      phone: s("phone"),
      whatsapp: s("whatsapp").replace(/[^\d+]/g, ""),
      email: s("email"),
      notificationEmail: s("notificationEmail"),
      addressLine: s("addressLine"),
      locality: s("locality"),
      city: s("city"),
      district: s("district"),
      state: s("state"),
      pincode: s("pincode"),
      mapUrl: s("mapUrl"),
      hours: s("hours"),
      gstin: s("gstin").toUpperCase(),
      detailsVerified: fd.bool(form, "detailsVerified"),
      social: { facebook: s("facebook"), instagram: s("instagram"), youtube: s("youtube"), googleBusiness: s("googleBusiness") },
    });
    await ctx.audit("settings.business", "settings", "business");
    return "Business details saved.";
  });
}

export async function saveCheckoutAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    const codMax = fd.str(form, "codMaxOrder").trim();
    await saveSettings(ctx.db, "checkout", {
      onlinePaymentsEnabled: fd.bool(form, "onlinePaymentsEnabled"),
      codEnabled: fd.bool(form, "codEnabled"),
      codMaxOrderPaise: codMax ? parseRupeesToPaise(codMax) : null,
      paymentWindowMinutes: Number(fd.str(form, "paymentWindowMinutes")) || 30,
      lowStockThreshold: Number(fd.str(form, "lowStockThreshold")) || 0,
      maxQuantityPerLine: Number(fd.str(form, "maxQuantityPerLine")) || 50,
      checkoutNote: fd.str(form, "checkoutNote"),
      acceptingOrders: fd.bool(form, "acceptingOrders"),
      pausedMessage: fd.str(form, "pausedMessage") || "We are not taking new orders right now. Please check back soon.",
    });
    await ctx.audit("settings.checkout", "settings", "checkout", { cod: fd.bool(form, "codEnabled"), online: fd.bool(form, "onlinePaymentsEnabled"), accepting: fd.bool(form, "acceptingOrders") });
    return "Checkout settings saved.";
  });
}

export async function saveNotificationSettingsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    await saveSettings(ctx.db, "notifications", {
      emailOwnerOnNewOrder: fd.bool(form, "emailOwnerOnNewOrder"),
      emailOwnerOnBulkEnquiry: fd.bool(form, "emailOwnerOnBulkEnquiry"),
      emailCustomers: fd.bool(form, "emailCustomers"),
    });
    return "Notification settings saved.";
  }, { revalidate: false });
}

export async function saveSeoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    const current = await getSettings(ctx.db, "seo");
    const image = fd.file(form, "ogImage");
    const uploaded = image ? await uploadImage(ctx.db, image, { alt: "Swastik", nameHint: "swastik-share-image", minSide: 600 }) : null;
    await saveSettings(ctx.db, "seo", {
      titleTemplate: fd.str(form, "titleTemplate"),
      defaultTitle: fd.str(form, "defaultTitle"),
      defaultDescription: fd.str(form, "defaultDescription"),
      ogImageId: uploaded?.id ?? (fd.bool(form, "removeOgImage") ? null : current.ogImageId),
      googleSiteVerification: fd.str(form, "googleSiteVerification"),
    });
    await ctx.audit("settings.seo", "settings", "seo");
    return "SEO settings saved.";
  });
}
